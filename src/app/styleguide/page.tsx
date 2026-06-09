import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isDevToolsEnabled } from '@/lib/dev-tools';
import { StyleGuide } from '@/components/dev/style-guide';

export const metadata: Metadata = {
  title: 'Design System · GuestHouse',
  robots: { index: false, follow: false },
};

export default function StyleGuidePage() {
  if (!isDevToolsEnabled()) notFound();
  return <StyleGuide />;
}
