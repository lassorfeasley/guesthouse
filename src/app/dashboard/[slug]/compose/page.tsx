import { redirect } from 'next/navigation';

export const metadata = { title: 'Compose an invitation' };

export default async function ComposePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/dashboard/${slug}/bookings`);
}
