'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { normalizePrefs } from '@/lib/notification-prefs';
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
    <div className="max-w-xl space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <PrefGroup
            title="Stay reminders"
            description="Trip reminders, checkout details, and post-stay notes for stays you're a guest on. Essential emails like booking confirmations are always sent."
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
                title="Host activity"
                description="Notifications about what's happening at homes you host."
              >
                {(
                  [
                    ['booking_requests', 'New booking requests'],
                    ['booking_cancelled', 'Booking cancellations'],
                    ['invitation_expiring', 'Invitations expiring soon'],
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
                title="Tips & nudges"
                description="Occasional suggestions to help you get the most out of hosting, like finishing your home profile."
              >
                <PrefToggle
                  prefs={prefs}
                  setPrefs={setPrefs}
                  prefKey="host_tips"
                  label="Hosting tips & suggestions"
                />
              </PrefGroup>

              <PrefGroup
                title="Product updates"
                description="Occasional news about new GuestHouse features. Marketing only — opt out anytime."
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
        </CardContent>
      </Card>

      {isPropertyOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Home managers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Home managers can run <strong>{propertyName}</strong> with you —
              calendar, guests, and requests — but cannot add other managers or
              delete the home.
            </p>
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
          </CardContent>
        </Card>
      )}
    </div>
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
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
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
