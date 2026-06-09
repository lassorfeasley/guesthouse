export type PlanId = 'free' | 'pro';

export type PlanIcon = 'home' | 'building' | 'sparkles';

export interface PricingPlan {
  id: PlanId;
  name: string;
  icon: PlanIcon;
  /** Headline price, e.g. "$0" or "$390" */
  price: string;
  /** Suffix shown next to the price, e.g. "/ year" */
  priceSuffix?: string;
  /** Short description under the price */
  tagline: string;
  /** Secondary pricing note, e.g. monthly equivalent */
  subtext?: string;
  features: string[];
  /** Muted footnote shown under the features (e.g. an upgrade nudge) */
  note?: string;
  cta: {
    label: string;
    href: string;
  };
  /** Fine print under the CTA */
  ctaNote?: string;
  recommended?: boolean;
}

// Single source of truth for plans. When Stripe is integrated, map each plan
// to its Stripe Price ID here (e.g. add `stripePriceId` fields below).
export const FREE_INCLUDED_STAYS = 2;

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free to start',
    icon: 'sparkles',
    price: '$0',
    tagline: 'No card — set up and feel it work',
    features: [
      'Add homes & rooms, build everything',
      'Your first 2 hosted stays, on us',
      'Guests always free, forever',
    ],
    note: 'After 2 stays, upgrade to keep hosting',
    cta: {
      label: 'Get started free',
      href: '/signup',
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: 'building',
    price: '$390',
    priceSuffix: '/ year',
    tagline: 'For hosts who keep their calendar busy',
    subtext: 'or $39 / month · save 17% annually',
    features: [
      'Unlimited hosted stays',
      'Unlimited homes & rooms',
      'Co-managers per property',
      'One flat price · no per-booking fees',
    ],
    cta: {
      label: 'Upgrade to Pro',
      href: '/signup',
    },
    recommended: true,
  },
];

export const PRO_ANNUAL_PRICE = '$390 / year';
export const PRO_MONTHLY_PRICE = '$39 / month';

export type BillingInterval = 'annual' | 'monthly';

export const STRIPE_PRICE_IDS: Record<BillingInterval, string | undefined> = {
  annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
  monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
};
