'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Users,
  Home,
  Settings,
  ChevronDown,
  LogOut,
  Plus,
  Check,
  Luggage,
  Shield,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { Property } from '@/types/database';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/brand/wordmark';

interface DashboardTopNavProps {
  properties: Property[];
  currentProperty: Property;
  userEmail?: string;
  userId?: string;
  showAdminLink?: boolean;
}

export function DashboardTopNav({
  properties,
  currentProperty,
  userEmail,
  userId,
  showAdminLink = false,
}: DashboardTopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/dashboard/${currentProperty.slug}`;
  const settingsHref = `${base}/settings`;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function isActive(href: string) {
    return pathname.startsWith(`${base}/${href}`);
  }

  function navLinkClass(active: boolean) {
    return cn(
      'flex h-auto items-center gap-2 rounded-md px-3 py-2 text-sm font-normal transition-colors',
      active
        ? 'bg-muted font-medium text-foreground'
        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <Link href="/dashboard" aria-label="Gracious home">
          <Wordmark className="h-5 text-primary" />
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                aria-label="Switch home"
                className={navLinkClass(isActive('overview'))}
              >
                <Home className="h-4 w-4 shrink-0" />
                <span className="hidden max-w-[200px] truncate sm:inline">
                  {currentProperty.name}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              {properties.length > 1 && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">
                      <LayoutGrid className="mr-2 h-4 w-4" />
                      All homes
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {properties.map((p) => (
                <DropdownMenuItem key={p.id} asChild>
                  <Link
                    href={`/dashboard/${p.slug}/overview`}
                    className="flex items-center justify-between"
                  >
                    <span>{p.name}</span>
                    {p.id === currentProperty.id && (
                      <Check className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Link>
                </DropdownMenuItem>
              ))}
              {userId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/add-home">
                      <Plus className="mr-2 h-4 w-4" />
                      Add another home
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Link
            href={`${base}/bookings`}
            aria-label="Visits"
            className={navLinkClass(isActive('bookings'))}
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Visits</span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Settings and account"
                className={cn(
                  'text-muted-foreground hover:text-foreground',
                  isActive('settings') && 'bg-muted text-foreground'
                )}
              >
                <Settings className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuItem asChild>
                <Link href={settingsHref}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/my-trips">
                  <Luggage className="mr-2 h-4 w-4" />
                  My trips
                </Link>
              </DropdownMenuItem>
              {showAdminLink && (
                <DropdownMenuItem asChild>
                  <Link href="/admin">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin
                  </Link>
                </DropdownMenuItem>
              )}
              {userEmail && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                    {userEmail}
                  </DropdownMenuLabel>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  );
}
