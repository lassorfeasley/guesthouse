import Link from 'next/link';
import { Mail, MessageSquare, ChevronRight, BellOff } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSiteAdmin } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/dates';
import { MessagingTabs, type MessagingTab } from '@/components/admin/messaging-tabs';
import {
  ALL_LOG_TYPES,
  GUEST_JOURNEY,
  HOST_JOURNEY,
  ACCOUNT_JOURNEY,
  getMessage,
  messageForLogType,
  messagesForRecipient,
  type AutomatedMessage,
  type JourneyStep,
  type MessageRecipient,
} from '@/lib/messaging/registry';

export const metadata = { title: 'Messaging · Admin' };

interface MessageStats {
  count30d: number;
  lastSent: string | null;
}

type StatsMap = Map<string, MessageStats>;

const FLOWS: {
  value: MessageRecipient;
  label: string;
  journeyTitle: string;
  journeySubtitle: string;
  steps: JourneyStep[];
}[] = [
  {
    value: 'guest',
    label: 'Guest',
    journeyTitle: 'The guest journey',
    journeySubtitle:
      'What lands in a guest\u2019s inbox, in the order it arrives — invitation through the morning after checkout. Click a step to see the email.',
    steps: GUEST_JOURNEY,
  },
  {
    value: 'host',
    label: 'Host',
    journeyTitle: 'The host journey',
    journeySubtitle:
      'Deliberately minimal — hosts only hear about things that need attention or change their calendar.',
    steps: HOST_JOURNEY,
  },
  {
    value: 'account',
    label: 'Account',
    journeyTitle: 'Account & access',
    journeySubtitle:
      'Authentication emails sent by Supabase through our Send Email hook. These fire on auth events, not on a booking timeline.',
    steps: ACCOUNT_JOURNEY,
  },
];

export default async function AdminMessagingPage() {
  await requireSiteAdmin();
  const admin = createAdminClient();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: logs } = await admin
    .from('notifications_log')
    .select('type, created_at')
    .in('type', ALL_LOG_TYPES)
    .gte('created_at', since.toISOString());

  const statsByMessage: StatsMap = new Map();
  for (const log of logs ?? []) {
    const message = messageForLogType(log.type);
    if (!message) continue;
    const existing = statsByMessage.get(message.id) ?? {
      count30d: 0,
      lastSent: null,
    };
    existing.count30d += 1;
    if (!existing.lastSent || log.created_at > existing.lastSent) {
      existing.lastSent = log.created_at;
    }
    statsByMessage.set(message.id, existing);
  }

  const tabs: MessagingTab[] = FLOWS.map((flow) => {
    const messages = messagesForRecipient(flow.value);
    return {
      value: flow.value,
      label: `${flow.label} · ${messages.length}`,
      content: (
        <>
          <Journey
            title={flow.journeyTitle}
            subtitle={flow.journeySubtitle}
            steps={flow.steps}
          />
          <TemplateInventory
            messages={messages}
            statsByMessage={statsByMessage}
          />
        </>
      ),
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messaging</h1>
        <p className="mt-1 text-muted-foreground">
          Every automated email, organized by who receives it.
        </p>
      </div>

      <MessagingTabs tabs={tabs} />

      <section className="rounded-xl border border-dashed bg-muted/20 p-5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">SMS / text messages</h2>
          <Badge variant="secondary" className="text-[11px]">
            Planned
          </Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          No SMS provider is connected yet. When text messaging is added, those
          automations will appear here alongside email.
        </p>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Journey — the primary artifact. Each step is one moment in time; if it maps
// to a single email the whole card links to it.
// ---------------------------------------------------------------------------

function Journey({
  title,
  subtitle,
  steps,
}: {
  title: string;
  subtitle: string;
  steps: JourneyStep[];
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <JourneyCard key={i} index={i + 1} step={step} />
        ))}
      </ol>
    </section>
  );
}

function JourneyCard({ index, step }: { index: number; step: JourneyStep }) {
  const linkedMessages = (step.messageIds ?? [])
    .map((id) => getMessage(id))
    .filter((m): m is AutomatedMessage => Boolean(m));

  const singleLink =
    linkedMessages.length === 1 ? `/admin/messaging/${linkedMessages[0].id}` : null;

  const inner = (
    <>
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          step.planned
            ? 'border border-dashed text-muted-foreground'
            : 'bg-foreground text-background'
        }`}
      >
        {index}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={`font-medium ${step.planned ? 'text-muted-foreground' : ''}`}>
            {step.title}
          </span>
          <span className="text-xs text-muted-foreground">{step.when}</span>
        </div>
        {step.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
        )}
        {linkedMessages.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {linkedMessages.map((m) => (
              <Link
                key={m.id}
                href={`/admin/messaging/${m.id}`}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-muted"
              >
                <Mail className="h-3 w-3" />
                {m.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 self-center">
        {step.planned && (
          <Badge variant="secondary" className="text-[11px]">
            Planned
          </Badge>
        )}
        {singleLink && (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </>
  );

  const cardClass = `flex items-start gap-3 rounded-xl border p-4 ${
    step.planned ? 'border-dashed bg-muted/20' : 'bg-card'
  }`;

  return (
    <li>
      {singleLink ? (
        <Link
          href={singleLink}
          className={`${cardClass} transition-colors hover:bg-muted/40`}
        >
          {inner}
        </Link>
      ) : (
        <div className={cardClass}>{inner}</div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Template inventory — secondary, compact reference with delivery stats.
// ---------------------------------------------------------------------------

function TemplateInventory({
  messages,
  statsByMessage,
}: {
  messages: AutomatedMessage[];
  statsByMessage: StatsMap;
}) {
  if (messages.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          All templates
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Compact reference with delivery stats for the last 30 days.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border divide-y">
        {messages.map((message) => {
          const stats = statsByMessage.get(message.id);
          return (
            <Link
              key={message.id}
              href={`/admin/messaging/${message.id}`}
              className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
            >
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />

              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">{message.name}</span>
                {message.status === 'planned' && (
                  <Badge variant="secondary" className="text-[11px]">
                    Planned
                  </Badge>
                )}
                {message.notificationPref && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <BellOff className="h-3 w-3" />
                    {message.notificationPref.label}
                  </span>
                )}
              </div>

              <span className="hidden shrink-0 text-xs text-muted-foreground md:block">
                {message.timing}
              </span>

              <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                {message.logTypes.length === 0 ? (
                  '—'
                ) : (
                  <>
                    <span className="font-medium tabular-nums text-foreground">
                      {stats?.count30d ?? 0}
                    </span>{' '}
                    {stats?.lastSent
                      ? `· ${formatDate(stats.lastSent)}`
                      : 'in 30d'}
                  </>
                )}
              </span>

              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
