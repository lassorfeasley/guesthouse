'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Home,
  CalendarDays,
  Mail,
  Inbox,
  FileText,
  LogOut,
  Luggage,
  ArrowLeft,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Logomark } from '@/components/brand/wordmark';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const LINKS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/properties', label: 'Properties', icon: Home },
  { href: '/admin/visits', label: 'Visits', icon: CalendarDays },
  { href: '/admin/messaging', label: 'Messaging', icon: Mail },
  { href: '/admin/email-queue', label: 'Email queue', icon: Inbox },
  { href: '/admin/legal', label: 'Legal', icon: FileText },
];

export function AdminSidebar({
  userEmail,
  exitHref,
  showHostLink,
}: {
  userEmail: string;
  exitHref: string;
  showHostLink: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <Link
          href="/admin"
          aria-label="Gracious Admin"
          className="flex items-center gap-2 px-2 py-1.5"
        >
          <Logomark className="h-6 w-6 shrink-0" />
          <span className="font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Gracious{' '}
            <span className="font-normal text-muted-foreground">Admin</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {LINKS.map(({ href, label, icon: Icon, exact }) => {
                const active = exact
                  ? pathname === href
                  : pathname.startsWith(href);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={label}>
                      <Link href={href}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="truncate px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          {userEmail}
        </div>
        <SidebarMenu>
          {showHostLink && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Host dashboard">
                <Link href="/dashboard">
                  <Home />
                  <span>Host dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="My trips">
              <Link href="/my-trips">
                <Luggage />
                <span>My trips</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Exit admin">
              <Link href={exitHref}>
                <ArrowLeft />
                <span>Exit admin</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Log out">
              <LogOut />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
