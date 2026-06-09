import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { DevToolbar } from '@/components/dev/dev-toolbar';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display-family',
});

export const metadata: Metadata = {
  title: 'GuestHouse',
  description: 'Private invitation-only vacation home booking',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${display.variable} font-sans antialiased`}
      >
        <Suspense fallback={null}>
          <DevToolbar />
        </Suspense>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
