import type { NotificationPrefs } from '@/types/database';

/**
 * Every email is transactional except product updates. Some transactional
 * categories are mandatory (auth, invitations, booking confirmations) and have
 * no flag here — they always send. The flags below are the opt-out categories.
 */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  booking_requests: true,
  booking_cancelled: true,
  invitation_expiring: true,
  guest_reminders: true,
  host_tips: true,
  product_updates: true,
};

/** Fills any missing keys with their default (opted-in) value. */
export function normalizePrefs(
  prefs: Partial<NotificationPrefs> | null | undefined
): NotificationPrefs {
  return { ...DEFAULT_NOTIFICATION_PREFS, ...(prefs ?? {}) };
}

/** Whether the recipient still wants emails for the given flag (default yes). */
export function wantsEmail(
  prefs: Partial<NotificationPrefs> | null | undefined,
  key: keyof NotificationPrefs
): boolean {
  return prefs?.[key] !== false;
}

/**
 * Public unsubscribe groupings. A single link can opt someone out of a whole
 * group (e.g. all host activity) without exposing the granular flags.
 */
export type UnsubscribeCategory =
  | 'guest_reminders'
  | 'host_activity'
  | 'host_tips'
  | 'product_updates';

export const CATEGORY_FLAGS: Record<
  UnsubscribeCategory,
  (keyof NotificationPrefs)[]
> = {
  guest_reminders: ['guest_reminders'],
  host_activity: ['booking_requests', 'booking_cancelled', 'invitation_expiring'],
  host_tips: ['host_tips'],
  product_updates: ['product_updates'],
};

export interface CategoryMeta {
  label: string;
  description: string;
  /** Which kind of recipient this applies to, for grouping in the UI. */
  audience: 'guest' | 'host';
}

export const CATEGORY_META: Record<UnsubscribeCategory, CategoryMeta> = {
  guest_reminders: {
    label: 'Stay reminders',
    description:
      "Trip reminders, checkout details, and post-stay notes for stays you're a guest on.",
    audience: 'guest',
  },
  host_activity: {
    label: 'Host activity notifications',
    description:
      'Booking requests, cancellations, and expiring invitations for homes you host.',
    audience: 'host',
  },
  host_tips: {
    label: 'Tips & nudges',
    description:
      'Occasional suggestions to help you get the most out of hosting, like finishing your home profile.',
    audience: 'host',
  },
  product_updates: {
    label: 'Product updates',
    description: 'Occasional news about new GuestHouse features. Marketing only.',
    audience: 'host',
  },
};

/** Display label for a category. */
export const CATEGORY_LABELS: Record<UnsubscribeCategory, string> =
  Object.fromEntries(
    (Object.keys(CATEGORY_META) as UnsubscribeCategory[]).map((key) => [
      key,
      CATEGORY_META[key].label,
    ])
  ) as Record<UnsubscribeCategory, string>;

/** Stable display order for preference centers. */
export const ALL_UNSUBSCRIBE_CATEGORIES: UnsubscribeCategory[] = [
  'guest_reminders',
  'host_activity',
  'host_tips',
  'product_updates',
];

export function isUnsubscribeCategory(
  value: string
): value is UnsubscribeCategory {
  return value in CATEGORY_FLAGS;
}

/** Returns a copy of prefs with every flag in a category set to subscribed. */
export function applyCategorySubscription(
  prefs: NotificationPrefs,
  category: UnsubscribeCategory,
  subscribed: boolean
): NotificationPrefs {
  const next = { ...prefs };
  for (const flag of CATEGORY_FLAGS[category]) {
    next[flag] = subscribed;
  }
  return next;
}

/** True if the recipient is still subscribed to any flag in the category. */
export function isSubscribedToCategory(
  prefs: NotificationPrefs,
  category: UnsubscribeCategory
): boolean {
  return CATEGORY_FLAGS[category].some((flag) => prefs[flag] !== false);
}
