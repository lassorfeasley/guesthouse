import { requireSiteAdmin, getNonAdminHomePath, userManagesAnyProperty } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSiteAdmin();
  const showHostLink = await userManagesAnyProperty(user.id);
  const exitHref = await getNonAdminHomePath(user);

  return (
    <SidebarProvider>
      <AdminSidebar
        userEmail={user.email}
        exitHref={exitHref}
        showHostLink={showHostLink}
      />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
