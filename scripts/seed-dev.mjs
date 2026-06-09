// Dev seed: creates stable dev accounts (owner/admin/guest) plus a sample
// property, rooms, invitation and booking so every authed screen has content
// to style. Idempotent — safe to re-run.
//
// Run against your dev Supabase project:
//   npm run db:seed:dev
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
// (the npm script loads it via --env-file).

import { createClient } from '@supabase/supabase-js';
import dev from '../src/lib/dev-accounts.json' with { type: 'json' };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    '\n✗ Missing env. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n' +
      '  Make sure they are set in .env.local (or pass another --env-file).\n'
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Stable IDs so re-runs upsert instead of duplicating.
const IDS = {
  rooms: [
    'd0d0d0d0-0000-4000-8000-000000000011',
    'd0d0d0d0-0000-4000-8000-000000000012',
  ],
  invitation: dev.inviteToken, // also used as the invitation id for simplicity
  booking: 'd0d0d0d0-0000-4000-8000-000000000031',
  bookingDates: 'd0d0d0d0-0000-4000-8000-000000000041',
};

function isoDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

async function findUserByEmail(email) {
  // listUsers is paginated; scan pages until found.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

async function ensureAuthUser(acct) {
  const user_metadata = {
    first_name: acct.firstName,
    last_name: acct.lastName,
    // Trigger maps only owner/guest; admin role is applied below.
    role: acct.role === 'admin' ? 'guest' : acct.role,
  };

  const { data: created, error } = await supabase.auth.admin.createUser({
    email: acct.email,
    password: dev.password,
    email_confirm: true,
    user_metadata,
  });

  let userId = created?.user?.id;

  if (error) {
    const existing = await findUserByEmail(acct.email);
    if (!existing) throw error;
    userId = existing.id;
    await supabase.auth.admin.updateUserById(userId, {
      password: dev.password,
      email_confirm: true,
      user_metadata,
    });
    console.log(`  • updated existing auth user ${acct.email}`);
  } else {
    console.log(`  • created auth user ${acct.email}`);
  }

  // Ensure the public.users profile row exists with the right role.
  // (name is a generated column — never write it directly.)
  const { error: upsertErr } = await supabase.from('users').upsert(
    {
      id: userId,
      email: acct.email,
      first_name: acct.firstName,
      last_name: acct.lastName,
      role: acct.role,
    },
    { onConflict: 'id' }
  );
  if (upsertErr) throw upsertErr;

  return userId;
}

async function main() {
  console.log(`\nSeeding dev data into ${url}\n`);

  console.log('Accounts:');
  const ids = {};
  for (const acct of dev.accounts) {
    ids[acct.role] = await ensureAuthUser(acct);
  }

  console.log('\nSample property + content:');
  const ownerId = ids.owner;
  const guestId = ids.guest;

  const { error: propErr } = await supabase.from('properties').upsert(
    {
      id: dev.property.id,
      owner_id: ownerId,
      name: dev.property.name,
      slug: dev.property.slug,
      description:
        'A bright, two-bedroom cottage a short walk from the water. Perfect for a quiet weekend with friends or family.',
      address: '12 Shoreline Dr, Mendocino, CA',
    },
    { onConflict: 'id' }
  );
  if (propErr) throw propErr;
  console.log(`  • property "${dev.property.name}" (/${dev.property.slug})`);

  const rooms = [
    {
      id: IDS.rooms[0],
      property_id: dev.property.id,
      name: 'Primary Suite',
      description: 'King bed, ensuite bath, ocean view.',
      max_occupancy: 2,
      display_order: 0,
    },
    {
      id: IDS.rooms[1],
      property_id: dev.property.id,
      name: 'Garden Room',
      description: 'Two twin beds opening onto the garden.',
      max_occupancy: 2,
      display_order: 1,
    },
  ];
  const { error: roomsErr } = await supabase
    .from('rooms')
    .upsert(rooms, { onConflict: 'id' });
  if (roomsErr) throw roomsErr;
  console.log(`  • ${rooms.length} rooms`);

  const { error: inviteErr } = await supabase.from('invitations').upsert(
    {
      id: IDS.invitation,
      token: dev.inviteToken,
      property_id: dev.property.id,
      guest_email: dev.accounts.find((a) => a.role === 'guest').email,
      guest_first_name: 'Gabby',
      guest_last_name: 'Guest',
      type: 'standing',
      status: 'accepted',
      created_by: ownerId,
    },
    { onConflict: 'id' }
  );
  if (inviteErr) throw inviteErr;
  console.log(`  • invitation (token ${dev.inviteToken})`);

  const { error: bookingErr } = await supabase.from('bookings').upsert(
    {
      id: IDS.booking,
      invitation_id: IDS.invitation,
      property_id: dev.property.id,
      guest_user_id: guestId,
      guest_first_name: 'Gabby',
      guest_last_name: 'Guest',
      status: 'requested',
      party_size: 2,
      notes: 'Hoping to celebrate a birthday — flexible on rooms!',
    },
    { onConflict: 'id' }
  );
  if (bookingErr) throw bookingErr;

  const { error: datesErr } = await supabase.from('booking_dates').upsert(
    {
      id: IDS.bookingDates,
      booking_id: IDS.booking,
      check_in: isoDate(21),
      check_out: isoDate(24),
    },
    { onConflict: 'id' }
  );
  if (datesErr) throw datesErr;

  const { error: bRoomErr } = await supabase.from('booking_rooms').upsert(
    {
      booking_id: IDS.booking,
      room_id: IDS.rooms[0],
    },
    { onConflict: 'booking_id,room_id' }
  );
  if (bRoomErr) throw bRoomErr;
  console.log('  • sample booking request (pending approval)');

  console.log('\n✓ Done. Dev sign-in password for all accounts: ' + dev.password);
  console.log('  Use the "Sign in as" buttons in the dev toolbar.\n');
}

main().catch((err) => {
  console.error('\n✗ Seed failed:', err.message ?? err);
  process.exit(1);
});
