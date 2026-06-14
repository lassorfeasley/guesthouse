import { ImageResponse } from 'next/og';
import { getInvitationByToken, invitationHostName } from '@/lib/invitations';
import { propertyOgImage } from '@/lib/og/images';
import { BrandCard, PhotoCard, loadOgFonts, OG_SIZE } from '@/lib/og/card';

export const alt = 'Your invitation to stay';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);
  const fonts = await loadOgFonts();

  if (!invitation) {
    return new ImageResponse(
      <BrandCard />,
      { ...size, fonts }
    );
  }

  const property = invitation.property;
  return new ImageResponse(
    (
      <PhotoCard
        imageUrl={propertyOgImage(property)}
        eyebrow="You're invited to stay"
        title={property.name}
        subtitle={`Hosted by ${invitationHostName(invitation)}`}
      />
    ),
    { ...size, fonts }
  );
}
