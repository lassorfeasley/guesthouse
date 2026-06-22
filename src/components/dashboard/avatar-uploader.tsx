'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UploadCloud, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { toast } from 'sonner';

interface AvatarUploaderProps {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

function storagePathFromUrl(url: string): string | null {
  const marker = '/avatars/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

export function AvatarUploader({
  userId,
  name,
  email,
  avatarUrl,
}: AvatarUploaderProps) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(avatarUrl);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setBusy(true);
    const supabase = createClient();
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);
      if (updateError) throw updateError;

      // Remove the previous file so the bucket doesn't accumulate orphans.
      if (url) {
        const prev = storagePathFromUrl(url);
        if (prev && prev !== path) {
          await supabase.storage.from('avatars').remove([prev]);
        }
      }

      setUrl(publicUrl);
      toast.success('Photo updated');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!url) return;
    setBusy(true);
    const supabase = createClient();
    try {
      const path = storagePathFromUrl(url);
      if (path) await supabase.storage.from('avatars').remove([path]);
      const { error } = await supabase
        .from('users')
        .update({ avatar_url: null })
        .eq('id', userId);
      if (error) throw error;
      setUrl(null);
      toast.success('Photo removed');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove photo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <PersonAvatar name={name} imageUrl={url} seed={email} size="xl" />
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </span>
        )}
      </div>
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <UploadCloud className="mr-1.5 h-4 w-4" />
            {url ? 'Change photo' : 'Upload photo'}
          </Button>
          {url && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={busy}
              onClick={handleRemove}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          PNG or JPG. Shown to your guests on invitations and stays.
        </p>
      </div>
    </div>
  );
}
