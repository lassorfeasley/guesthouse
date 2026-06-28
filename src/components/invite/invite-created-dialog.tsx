'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Mail, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getInviteUrl } from '@/lib/invite-url';
import { AddToCalendarButton } from '@/components/add-to-calendar-button';

interface InviteCreatedDialogProps {
  token: string;
  /** Server-computed URL used for the first render to avoid hydration drift. */
  initialUrl: string;
  propertyName: string;
  guestEmail: string;
  guestName?: string;
  /** Whether the invitation has concrete dates; hides the calendar CTA if not. */
  hasDates?: boolean;
}

export function InviteCreatedDialog({
  token,
  initialUrl,
  propertyName,
  guestEmail,
  guestName,
  hasDates = false,
}: InviteCreatedDialogProps) {
  const [open, setOpen] = useState(true);
  const [url, setUrl] = useState(initialUrl);
  const [copied, setCopied] = useState(false);

  // Prefer the live origin once mounted so the shared link matches the host's
  // current host/port, and drop the ?created flag so a refresh won't reopen.
  useEffect(() => {
    setUrl(getInviteUrl(token));
    if (typeof window !== 'undefined') {
      const next = new URL(window.location.href);
      if (next.searchParams.has('created')) {
        next.searchParams.delete('created');
        window.history.replaceState(null, '', next.toString());
      }
    }
  }, [token]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Invite link copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select and copy the link manually');
    }
  }

  const greeting = guestName ? guestName.split(' ')[0] : 'there';
  const shareBody = `Hi ${greeting}, you're invited to stay at ${propertyName}. View the details and pick your dates here: ${url}`;
  const smsHref = `sms:?&body=${encodeURIComponent(shareBody)}`;
  const mailHref = `mailto:${encodeURIComponent(guestEmail)}?subject=${encodeURIComponent(
    `You're invited to stay at ${propertyName}`
  )}&body=${encodeURIComponent(shareBody)}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 sm:mx-0">
            <Check className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl">Invitation sent</DialogTitle>
          <DialogDescription>
            We emailed{' '}
            <span className="font-medium text-foreground">{guestEmail}</span> an
            invitation to {propertyName}. You can also share the link directly.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 min-w-0 space-y-3">
          <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {url}
            </span>
          </div>

          <Button
            type="button"
            size="lg"
            onClick={copyLink}
            className="h-12 w-full text-base"
          >
            {copied ? (
              <>
                <Check className="h-5 w-5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-5 w-5" />
                Copy invite link
              </>
            )}
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-11" asChild>
              <a href={smsHref}>
                <MessageSquareText className="h-4 w-4" />
                Share via text
              </a>
            </Button>
            <Button variant="outline" className="h-11" asChild>
              <a href={mailHref}>
                <Mail className="h-4 w-4" />
                Share via email
              </a>
            </Button>
          </div>

          {hasDates && (
            <div className="mt-3 border-t pt-3">
              <p className="mb-2 text-sm font-medium">For your calendar</p>
              <AddToCalendarButton
                baseUrl={`/api/invitations/${token}/ical`}
                size="default"
                className="w-full"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
