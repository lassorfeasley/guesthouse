'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { normalizePrefs } from '@/lib/notification-prefs';
import { AvatarUploader } from '@/components/dashboard/avatar-uploader';
import { formatPersonName } from '@/lib/names';
import type { NotificationPrefs, User } from '@/types/database';

interface SettingsFormProps {
  user: User;
  propertyId: string;
  propertyName: string;
  isPropertyOwner: boolean;
  managers: { id: string; user: { email: string; name: string | null } }[];
}

export function SettingsForm({
  user,
  propertyId,
  propertyName,
  isPropertyOwner,
  managers,
}: SettingsFormProps) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    normalizePrefs(user.notification_prefs)
  );
  const [managerEmail, setManagerEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(propertyName);
  const [savingName, setSavingName] = useState(false);

  async function savePropertyName() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Home name cannot be empty');
      return;
    }
    setSavingName(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('properties')
      .update({ name: trimmed })
      .eq('id', propertyId);
    setSavingName(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Home name updated');
    router.refresh();
  }

  async function savePrefs() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('users')
      .update({ notification_prefs: prefs })
      .eq('id', user.id);
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success('Preferences saved');
  }

  async function addManager() {
    if (!managerEmail) return;
    setLoading(true);
    const supabase = createClient();

    const { data: managerUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', managerEmail.toLowerCase())
      .single();

    if (!managerUser) {
      toast.error('User not found. They need an account first.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('property_managers').insert({
      property_id: propertyId,
      user_id: managerUser.id,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Co-manager added');
    setManagerEmail('');
    router.refresh();
  }

  async function removeManager(id: string) {
    const supabase = createClient();
    await supabase.from('property_managers').delete().eq('id', id);
    toast.success('Co-manager removed');
    router.refresh();
  }

  return (
    <>
      <section className="py-8">
        <h2 className="text-lg font-medium">Your profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your photo appears next to your name across Gracious.
        </p>
        <div className="mt-6">
          <AvatarUploader
            userId={user.id}
            name={formatPersonName(user, user.email) ?? user.email}
            email={user.email}
            avatarUrl={user.avatar_url}
          />
        </div>
      </section>

      <section className="py-8">
        <h2 className="text-lg font-medium">Home name</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This is how your home appears across Gracious — to you and your
          guests.
        </p>
        <div className="mt-6 flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Home name"
          />
          <Button
            onClick={savePropertyName}
            disabled={savingName || name.trim() === propertyName}
          >
            {savingName ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </section>

      <section className="py-8">
        <h2 className="text-lg font-medium">Email preferences</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which emails you receive from Gracious.
        </p>
        <div className="mt-6 space-y-8">
          <PrefGroup
            title="Guest emails"
            description="For stays you're a guest on — trip reminders, checkout details, and post-stay notes. Essential emails like visit confirmations are always sent."
          >
            <PrefToggle
              prefs={prefs}
              setPrefs={setPrefs}
              prefKey="guest_reminders"
              label="Stay reminders & follow-ups"
            />
          </PrefGroup>

          {isPropertyOwner && (
            <>
              <PrefGroup
                title="Host emails"
                description="Activity and tips for homes you host."
              >
                {(
                  [
                    ['visit_requests', 'New visit requests'],
                    ['visit_cancelled', 'Visit cancellations'],
                    ['invitation_expiring', 'Invitations expiring soon'],
                    ['invitation_stalled', 'Invites that went quiet'],
                    ['host_tips', 'Hosting tips & suggestions'],
                  ] as const
                ).map(([key, label]) => (
                  <PrefToggle
                    key={key}
                    prefs={prefs}
                    setPrefs={setPrefs}
                    prefKey={key}
                    label={label}
                  />
                ))}
              </PrefGroup>

              <PrefGroup
                title="Account emails"
                description="News about Gracious itself. Marketing only — opt out anytime."
              >
                <PrefToggle
                  prefs={prefs}
                  setPrefs={setPrefs}
                  prefKey="product_updates"
                  label="Product updates & announcements"
                />
              </PrefGroup>
            </>
          )}

          <Button onClick={savePrefs} disabled={loading}>
            Save preferences
          </Button>
        </div>
      </section>

      {isPropertyOwner && (
        <section className="py-8">
          <h2 className="text-lg font-medium">Home managers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Home managers can run <strong>{propertyName}</strong> with you —
            calendar, guests, and requests — but cannot add other managers or
            delete the home.
          </p>
          <div className="mt-6 space-y-4">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="manager@email.com"
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
              />
              <Button onClick={addManager} disabled={loading}>
                Add
              </Button>
            </div>
            {managers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No home managers yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {managers.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                  >
                    <span>{m.user.name ?? m.user.email}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => removeManager(m.id)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </>
  );
}

function PrefGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function PrefToggle({
  prefs,
  setPrefs,
  prefKey,
  label,
}: {
  prefs: NotificationPrefs;
  setPrefs: (prefs: NotificationPrefs) => void;
  prefKey: keyof NotificationPrefs;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={prefKey}>{label}</Label>
      <Switch
        id={prefKey}
        checked={prefs[prefKey]}
        onCheckedChange={(v) => setPrefs({ ...prefs, [prefKey]: v })}
      />
    </div>
  );
}
