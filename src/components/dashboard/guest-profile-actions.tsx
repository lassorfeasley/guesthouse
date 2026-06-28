'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { getInviteUrl } from '@/lib/invite-url';
import { CancelHostVisitButton } from '@/components/dashboard/cancel-host-visit-button';

interface GuestProfileActionsProps {
  invitationToken?: string | null;
  invitationId?: string | null;
  invitationStatus?: string;
  manualVisitId?: string | null;
}

export function GuestProfileActions({
  invitationToken,
  invitationId,
  invitationStatus,
  manualVisitId,
}: GuestProfileActionsProps) {
  const router = useRouter();

  function copyLink() {
    if (!invitationToken) return;
    navigator.clipboard.writeText(getInviteUrl(invitationToken));
    toast.success('Invite link copied');
  }

  async function revoke() {
    if (!invitationId) return;
    if (!window.confirm('Revoke this invitation? The link will stop working.')) {
      return;
    }
    const res = await fetch('/api/invitations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitation_id: invitationId, action: 'revoke' }),
    });
    if (!res.ok) {
      toast.error('Failed to revoke');
      return;
    }
    toast.success('Invitation revoked');
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {invitationToken && invitationStatus !== 'revoked' && (
        <>
          <Button variant="outline" size="sm" onClick={copyLink}>
            <Copy className="mr-1 h-4 w-4" />
            Copy invite link
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={revoke}
          >
            Revoke invitation
          </Button>
        </>
      )}
      {manualVisitId && (
        <CancelHostVisitButton visitId={manualVisitId} />
      )}
    </div>
  );
}
