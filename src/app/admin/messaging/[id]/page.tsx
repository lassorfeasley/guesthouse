import Link from 'next/link';
import { notFound } from 'next/navigation';
import { render } from '@react-email/components';
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Users,
  Zap,
  Clock,
  BellOff,
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSiteAdmin } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { EmailPreview } from '@/components/admin/email-preview';
import { formatDate } from '@/lib/dates';
import { getMessage } from '@/lib/messaging/registry';

export default async function AdminMessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSiteAdmin();
  const { id } = await params;
  const message = getMessage(id);
  if (!message) notFound();

  const admin = createAdminClient();

  const renderedVariants = await Promise.all(
    message.variants.map(async (v) => ({
      label: v.label,
      subject: v.subject,
      html: await render(v.element),
    }))
  );

  let recentSends: { type: string; created_at: string }[] | null = null;
  if (message.logTypes.length > 0) {
    const { data } = await admin
      .from('notifications_log')
      .select('type, created_at')
      .in('type', message.logTypes)
      .order('created_at', { ascending: false })
      .limit(20);
    recentSends = data ?? [];
  }

  const Icon = message.channel === 'sms' ? MessageSquare : Mail;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/admin/messaging"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All messages
        </Link>

        <div className="mt-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {message.name}
              </h1>
              {message.status === 'planned' ? (
                <Badge variant="secondary">Planned</Badge>
              ) : (
                <Badge>Active</Badge>
              )}
              <Badge variant="outline">{message.category}</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{message.description}</p>
          </div>
        </div>
      </div>

      {/* At-a-glance facts */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FactCard
          icon={<Users className="h-4 w-4" />}
          label="Who gets it"
          value={message.audience}
        />
        <FactCard
          icon={<Zap className="h-4 w-4" />}
          label="When it triggers"
          value={message.trigger}
        />
        <FactCard
          icon={<Clock className="h-4 w-4" />}
          label="Timing"
          value={message.timing}
        />
        <FactCard
          icon={<BellOff className="h-4 w-4" />}
          label="Opt-out"
          value={
            message.notificationPref ? (
              <span>
                Via <strong>{message.notificationPref.label}</strong> preference
                {!message.notificationPref.enforced && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px]">
                    not enforced
                  </Badge>
                )}
              </span>
            ) : (
              'Always sent — essential email'
            )
          }
        />
      </div>

      {/* Preview */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          What it looks like
        </h2>
        <EmailPreview variants={renderedVariants} />
      </section>

      {/* Recent sends */}
      {recentSends && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Recent sends
          </h2>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-4 py-3 font-medium">Sent</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {recentSends.map((s, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      {formatDate(s.created_at, 'MMM d, yyyy · h:mm a')}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <code className="text-xs">{s.type}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recentSends.length === 0 && (
              <p className="p-8 text-center text-muted-foreground">
                No sends recorded yet.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Engineering footnote */}
      <p className="text-xs text-muted-foreground">
        Triggered from <code className="rounded bg-muted px-1 py-0.5">{message.source}</code>
        {message.logTypes.length > 0 && (
          <>
            {' '}· logged as{' '}
            <code className="rounded bg-muted px-1 py-0.5">
              {message.logTypes.join(', ')}
            </code>
          </>
        )}
      </p>
    </div>
  );
}

function FactCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="mt-2 text-sm">{value}</div>
    </div>
  );
}
