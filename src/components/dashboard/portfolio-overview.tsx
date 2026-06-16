import Link from 'next/link';
import Image from 'next/image';
import { Plus, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardContainer } from '@/components/dashboard/dashboard-container';
import { PortfolioSchedule } from '@/components/dashboard/portfolio-schedule';
import { PortfolioBookingSidebar } from '@/components/dashboard/portfolio-booking-sidebar';
import { formatDateRange } from '@/lib/dates';
import type { PortfolioData, PortfolioHouse } from '@/lib/portfolio';

export function PortfolioOverview({
  firstName,
  portfolio,
}: {
  firstName?: string | null;
  portfolio: PortfolioData;
}) {
  return (
    <DashboardContainer>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {firstName ? `Welcome back, ${firstName}` : 'Your homes'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Every stay across your homes, on one schedule.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/add-home">
            <Plus className="mr-1 h-4 w-4" />
            Add home
          </Link>
        </Button>
      </div>

      <div className="mt-8">
        <PortfolioSchedule
          timelineRows={portfolio.timelineRows}
          calendarBookings={portfolio.calendarBookings}
          calendarBlocks={portfolio.calendarBlocks}
        />
      </div>

      <div className="mt-14 grid gap-x-12 gap-y-10 lg:grid-cols-[1fr_360px]">
        <section className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight">Your homes</h2>
          <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2">
            {portfolio.houses.map((house) => (
              <Link
                key={house.property.id}
                href={`/dashboard/${house.property.slug}/overview`}
                className="group block"
              >
                <HouseCard house={house} />
              </Link>
            ))}
          </div>
        </section>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <PortfolioBookingSidebar
            houses={portfolio.houses.map((h) => ({
              id: h.property.id,
              name: h.property.name,
              rooms: h.rooms,
              roomAvailability: h.roomAvailability,
            }))}
          />
        </aside>
      </div>
    </DashboardContainer>
  );
}

function HouseCard({ house }: { house: PortfolioHouse }) {
  const { property, roomCount, upcomingCount, nextStay } = house;
  const meta = `${roomCount} ${roomCount === 1 ? 'room' : 'rooms'}`;

  return (
    <div className="block">
      {property.hero_image_url ? (
        <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl">
          <Image
            src={property.hero_image_url}
            alt={property.name}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="relative flex aspect-4/3 w-full flex-col justify-end overflow-hidden rounded-2xl bg-linear-to-br from-slate-700 via-slate-800 to-slate-950 p-5 transition duration-300 group-hover:from-slate-600 group-hover:via-slate-700 group-hover:to-slate-900">
          <p className="text-lg font-medium text-white">{property.name}</p>
        </div>
      )}

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-medium">{property.name}</p>
          {property.address && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{property.address}</span>
            </p>
          )}
        </div>
        {upcomingCount > 0 && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {upcomingCount} upcoming
          </span>
        )}
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        {nextStay
          ? `${meta} · Next: ${nextStay.guestName}, ${formatDateRange(
              nextStay.checkIn,
              nextStay.checkOut
            )}`
          : `${meta} · No upcoming stays`}
      </p>
    </div>
  );
}
