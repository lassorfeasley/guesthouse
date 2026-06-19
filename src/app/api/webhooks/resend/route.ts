import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'standardwebhooks';
import { suppressEmail } from '@/lib/email/suppression';

// Node runtime: Svix signature verification needs full Node crypto APIs.
export const runtime = 'nodejs';

/**
 * Subset of the Resend webhook payload we act on. Resend signs events with Svix
 * and delivers `svix-id` / `svix-timestamp` / `svix-signature` headers.
 * See https://resend.com/docs/dashboard/webhooks/event-types
 */
interface ResendWebhookEvent {
  type: string;
  data?: {
    email_id?: string;
    to?: string[];
    bounce?: {
      type?: string;
      subType?: string;
      message?: string;
    };
  };
}

function verifyEvent(body: string, request: NextRequest): ResendWebhookEvent {
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  // In local dev without a configured secret, accept the payload as-is so the
  // webhook can be exercised with the Resend CLI. Never skip in production.
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_WEBHOOK_SECRET is not configured');
    }
    console.warn(
      '[resend-webhook] RESEND_WEBHOOK_SECRET not set — skipping signature verification (dev only)'
    );
    return JSON.parse(body) as ResendWebhookEvent;
  }

  const wh = new Webhook(secret.replace(/^whsec_/, ''));
  return wh.verify(body, {
    'webhook-id': request.headers.get('svix-id') ?? '',
    'webhook-timestamp': request.headers.get('svix-timestamp') ?? '',
    'webhook-signature': request.headers.get('svix-signature') ?? '',
  }) as ResendWebhookEvent;
}

/**
 * A bounce is permanent (the address is invalid) unless Resend explicitly marks
 * it transient. Transient bounces (full mailbox, greylisting) can recover, so
 * we don't suppress them. When the type is missing we treat it as permanent —
 * better to err toward protecting reputation.
 */
function isPermanentBounce(type?: string): boolean {
  const t = type?.toLowerCase();
  if (!t) return true;
  return t !== 'transient' && t !== 'softbounce' && t !== 'soft';
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  let event: ResendWebhookEvent;
  try {
    event = verifyEvent(body, request);
  } catch (err) {
    console.error('[resend-webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const recipients = event.data?.to ?? [];
    const emailId = event.data?.email_id ?? null;

    switch (event.type) {
      case 'email.bounced': {
        if (isPermanentBounce(event.data?.bounce?.type)) {
          for (const email of recipients) {
            await suppressEmail(email, 'hard_bounce', {
              providerMessageId: emailId,
              detail: event.data?.bounce?.message ?? null,
            });
          }
        }
        break;
      }
      case 'email.complained': {
        for (const email of recipients) {
          await suppressEmail(email, 'complaint', {
            providerMessageId: emailId,
          });
        }
        break;
      }
      default:
        // sent / delivered / delivery_delayed / opened / clicked — no action.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[resend-webhook] failed to process event:', err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
