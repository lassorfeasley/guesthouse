import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedHomePath } from '@/lib/auth';
import { isDevAdminPreviewEnabled } from '@/lib/dev-tools';
import { isSiteAdminEmail } from '@/lib/site-admin';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Preserve the query string so deep links (e.g. one-click approve/decline
  // from emails) survive the login round-trip.
  const redirectTarget = pathname + request.nextUrl.search;

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('redirect', redirectTarget);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set('redirect', redirectTarget);
      return NextResponse.redirect(url);
    }
    if (!isDevAdminPreviewEnabled()) {
      const { data: profile } = await supabase
        .from('users')
        .select('is_admin, email')
        .eq('id', user.id)
        .single();
      const allowed =
        profile?.is_admin ||
        (profile?.email && isSiteAdminEmail(profile.email));
      if (!allowed) {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
    }
  }

  // Redirect logged-in users away from auth pages to their default app home.
  if ((pathname === '/login' || pathname === '/signup') && user) {
    const { data: profile } = await supabase
      .from('users')
      .select('id, is_admin, email')
      .eq('id', user.id)
      .single();
    const url = request.nextUrl.clone();
    url.pathname = profile
      ? await getAuthenticatedHomePath(profile)
      : '/my-trips';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
