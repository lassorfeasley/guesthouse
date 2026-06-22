import type { ReactNode } from 'react';
import { Mail, Phone } from 'lucide-react';
import { PersonAvatar, type PersonAvatarSize } from '@/components/ui/person-avatar';
import { cn } from '@/lib/utils';

interface PersonCardProps {
  name: string;
  /** Uploaded avatar; falls back to a generated placeholder. */
  imageUrl?: string | null;
  /** Stable seed for the placeholder gradient (usually the email). */
  seed?: string | null;
  /**
   * A short relationship/role line describing this person in context —
   * "Your host", "Your sister", "Guest", etc.
   */
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Status badges rendered next to the name. */
  badges?: ReactNode;
  /** Action buttons rendered below the contact details. */
  actions?: ReactNode;
  /** Optional free-text note (e.g. a personal message). */
  note?: string | null;
  size?: PersonAvatarSize;
  className?: string;
}

/**
 * A standard, reusable card for displaying a person and their relationship to
 * the viewer. Used in both directions: a host viewing a guest, and a guest
 * viewing their host.
 */
export function PersonCard({
  name,
  imageUrl,
  seed,
  role,
  email,
  phone,
  badges,
  actions,
  note,
  size = 'lg',
  className,
}: PersonCardProps) {
  const hasContact = Boolean(email || phone);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border bg-card p-5 shadow-sm sm:p-6',
        className
      )}
    >
      <div className="flex items-start gap-4">
        <PersonAvatar name={name} imageUrl={imageUrl} seed={seed} size={size} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-lg font-semibold tracking-tight">{name}</h3>
            {badges}
          </div>

          {role ? (
            <p className="text-sm font-medium text-muted-foreground">{role}</p>
          ) : null}

          {hasContact ? (
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{email}</span>
                </a>
              ) : null}
              {phone ? (
                <a
                  href={`tel:${phone}`}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  {phone}
                </a>
              ) : null}
            </div>
          ) : null}

          {note ? (
            <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-sm italic text-muted-foreground">
              &ldquo;{note}&rdquo;
            </blockquote>
          ) : null}
        </div>
      </div>

      {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
