'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { parseISO, format } from 'date-fns';
import { Copy, ExternalLink, Mail, MessageSquareText, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBareCard } from '@/components/card-chrome';

interface InviteWindow {
  start: string;
  end: string;
}

interface HostVisit {
  id: string;
  status: 'requested' | 'approved';
  checkIn: string;
  checkOut: string;
}

interface HostVisitSidebarProps {
  slug: string;
  inviteUrl: string;
  invitationId: string;
  invitationStatus: string;
  propertyName: string;
  guestName?: string | null;
  guestEmail: string | null;
  windows: InviteWindow[];
  roomNames: string[];
  visit?: HostVisit | null;
}

const STATUS_META: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  pending: { label: 'Invitation pending', variant: 'secondary' },
  accepted: { label: 'Accepted', variant: 'default' },
  expired: { label: 'Expired', variant: 'outline' },
  revoked: { label: 'Revoked', variant: 'destructive' },
};

function fmt(date: string): string {
  return format(parseISO(date), 'EEE, MMM d');
}

export function HostVisitSidebar({
  slug,
  inviteUrl,
  invitationId,
  invitationStatus,
  propertyName,
  guestName,
  guestEmail,
  windows,
  roomNames,
  visit,
}: HostVisitSidebarProps) {
  const router = useRouter();
  const bare = useBareCard();
  const [revoking, setRevoking] = useState(false);

  const cardClass = cn(
    'p-6',
    !bare && 'rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.12)]'
  );

  const firstName = guestName?.split(/\s+/)[0];
  const greeting = firstName ? `Hi ${firstName}, ` : '';
  const shareBody = `${greeting}you're invited to stay at ${propertyName}. View the details and pick your dates here: ${inviteUrl}`;
  const subject = `You're invited to stay at ${propertyName}`;
  const smsHref = `sms:?&body=${encodeURIComponent(shareBody)}`;
  const mailHref = `mailto:${guestEmail ? encodeURIComponent(guestEmail) : ''}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(shareBody)}`;

  // The badge reflects where the invitation actually stands: an accepted visit
  // outranks the raw invitation status.
  const effectiveStatus = visit ? 'accepted' : invitationStatus;
  const meta = STATUS_META[effectiveStatus] ?? STATUS_META.pending;
  const canRevoke =
    !visit && invitationStatus !== 'revoked' && invitationStatus !== 'expired';

  function copyLink() {
    navigator.clipboard.writeText(inviteUrl);
    toast.success('Invite link copied');
  }

  async function shareLink() {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({
          title: 'Your invitation',
          text: shareBody,
          url: inviteUrl,
        });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    copyLink();
  }

  async function revoke() {
    if (
      !window.confirm('Revoke this invitation? The link will stop working.')
    ) {
      return;
    }
    setRevoking(true);
    const res = await fetch('/api/invitations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitation_id: invitationId, action: 'revoke' }),
    });
    setRevoking(false);
    if (!res.ok) {
      toast.error('Failed to revoke');
      return;
    }
    toast.success('Invitation revoked');
    router.refresh();
  }

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg font-semibold">Your invitation</p>
        <Badge variant={meta.variant} className="shrink-0">
          {meta.label}
        </Badge>
      </div>
      <p className="mt-1 truncate text-sm text-muted-foreground">
        For {guestName || guestEmail || 'your guest'}
      </p>

      {windows.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Invited dates
          </p>
          <div className="mt-1 space-y-0.5">
            {windows.map((w) => (
              <p key={`${w.start}-${w.end}`} className="text-sm">
                {fmt(w.start)} – {fmt(w.end)}
              </p>
            ))}
          </div>
        </div>
      )}

      {roomNames.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Rooms
          </p>
          <p className="mt-1 text-sm">{roomNames.join(', ')}</p>
        </div>
      )}

      <div className="mt-5 space-y-2">
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2 pl-3">
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {inviteUrl}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={copyLink}
            aria-label="Copy invite link"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <Button type="button" className="h-9 w-full" onClick={shareLink}>
          <Share2 />
          Share via link
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" size="sm" className="h-9">
            <a href={mailHref}>
              <Mail />
              Share via email
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-9">
            <a href={smsHref}>
              <MessageSquareText />
              Share via text
            </a>
          </Button>
        </div>
      </div>

      {visit && (
        <Button
          asChild
          variant="outline"
          className="mt-4 h-9 w-full"
        >
          <Link href={`/dashboard/${slug}/visits/${visit.id}`}>
            <ExternalLink />
            Manage visit
          </Link>
        </Button>
      )}

      {canRevoke && (
        <Button
          type="button"
          variant="ghost"
          className="mt-2 h-9 w-full text-destructive hover:text-destructive"
          onClick={revoke}
          disabled={revoking}
        >
          {revoking ? 'Revoking…' : 'Revoke invitation'}
        </Button>
      )}
    </div>
  );
}
