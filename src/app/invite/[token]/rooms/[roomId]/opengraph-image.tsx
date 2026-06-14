import { ImageResponse } from 'next/og';
import { getInvitationByToken } from '@/lib/invitations';
import { roomOgImage } from '@/lib/og/images';
import { BrandCard, PhotoCard, loadOgFonts, OG_SIZE } from '@/lib/og/card';

export const alt = 'A room for your stay';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ token: string; roomId: string }>;
}) {
  const { token, roomId } = await params;
  const invitation = await getInvitationByToken(token);
  const room = invitation?.rooms.find((r) => r.id === roomId);
  const fonts = await loadOgFonts();

  if (!invitation || !room) {
    return new ImageResponse(
      <BrandCard />,
      { ...size, fonts }
    );
  }

  return new ImageResponse(
    (
      <PhotoCard
        imageUrl={roomOgImage(room, invitation.property)}
        eyebrow={invitation.property.name}
        title={room.name}
        subtitle={`Sleeps up to ${room.max_occupancy}`}
      />
    ),
    { ...size, fonts }
  );
}
