import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe, getStripeWebhookSecret } from '@/lib/stripe';

async function setUserPro(
  userId: string,
  subscriptionId: string | null,
  customerId?: string | null
) {
  const admin = createAdminClient();
  const update: {
    plan: 'pro' | 'free';
    stripe_subscription_id: string | null;
    stripe_customer_id?: string;
  } = {
    plan: 'pro',
    stripe_subscription_id: subscriptionId,
  };

  if (customerId) {
    update.stripe_customer_id = customerId;
  }

  await admin.from('users').update(update).eq('id', userId);
}

async function setUserFree(userId: string) {
  const admin = createAdminClient();
  await admin
    .from('users')
    .update({ plan: 'free', stripe_subscription_id: null })
    .eq('id', userId);
}

async function resolveUserId(
  metadata: Stripe.Metadata | null | undefined,
  customerId?: string | null
): Promise<string | null> {
  if (metadata?.userId) {
    return metadata.userId;
  }

  if (!customerId) {
    return null;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  return data?.id ?? null;
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      getStripeWebhookSecret()
    );
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        const userId = await resolveUserId(
          session.metadata,
          typeof session.customer === 'string' ? session.customer : session.customer?.id
        );
        if (!userId) break;

        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id ?? null;

        await setUserPro(
          userId,
          subscriptionId,
          typeof session.customer === 'string' ? session.customer : session.customer?.id
        );
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(
          subscription.metadata,
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id
        );
        if (!userId) break;

        if (
          subscription.status === 'active' ||
          subscription.status === 'trialing'
        ) {
          await setUserPro(
            userId,
            subscription.id,
            typeof subscription.customer === 'string'
              ? subscription.customer
              : subscription.customer?.id
          );
        } else if (
          subscription.status === 'canceled' ||
          subscription.status === 'unpaid' ||
          subscription.status === 'incomplete_expired'
        ) {
          await setUserFree(userId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(
          subscription.metadata,
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id
        );
        if (!userId) break;

        await setUserFree(userId);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
