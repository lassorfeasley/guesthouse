'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

const DELETE_CONFIRM_TEXT = 'DELETE';

interface DeleteRoomConfirmProps {
  roomId: string;
  roomName: string;
  redirectTo: string;
  onDeleted?: () => void;
}

export function DeleteRoomConfirm({
  roomId,
  roomName,
  redirectTo,
  onDeleted,
}: DeleteRoomConfirmProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  function resetConfirm() {
    setShowConfirm(false);
    setConfirmText('');
  }

  async function deleteRoom() {
    if (confirmText !== DELETE_CONFIRM_TEXT) return;

    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from('rooms').delete().eq('id', roomId);
    setDeleting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Room deleted');
    onDeleted?.();
    router.push(redirectTo);
    router.refresh();
  }

  if (!showConfirm) {
    return (
      <Button
        type="button"
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() => setShowConfirm(true)}
      >
        <Trash2 className="mr-1 h-4 w-4" />
        Delete room
      </Button>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div>
        <p className="text-sm font-medium">Delete this room?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently remove {roomName}. This can&apos;t be undone and may
          affect existing bookings.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="delete-room-confirm">
          Type {DELETE_CONFIRM_TEXT} to confirm
        </Label>
        <Input
          id="delete-room-confirm"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={DELETE_CONFIRM_TEXT}
          autoComplete="off"
          disabled={deleting}
          autoFocus
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={confirmText !== DELETE_CONFIRM_TEXT || deleting}
          onClick={() => void deleteRoom()}
        >
          {deleting ? 'Deleting…' : 'Confirm delete'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={deleting}
          onClick={resetConfirm}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
