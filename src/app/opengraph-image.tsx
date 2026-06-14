import { ImageResponse } from 'next/og';
import { BrandCard, loadOgFonts, OG_SIZE } from '@/lib/og/card';

export const alt =
  'Gracious — A warm, private way to have friends and family to stay.';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    <BrandCard />,
    { ...size, fonts: await loadOgFonts() }
  );
}
