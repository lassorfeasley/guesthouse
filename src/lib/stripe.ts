import Stripe from 'stripe';
import { getEnv, getEnvOptional } from '@/lib/env';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(getEnv('STRIPE_SECRET_KEY'), {
      apiVersion: '2026-05-27.dahlia',
    });
  }
  return stripeClient;
}

export function getStripeWebhookSecret(): string {
  return getEnv('STRIPE_WEBHOOK_SECRET');
}

export function isStripeConfigured(): boolean {
  return Boolean(
    getEnvOptional('STRIPE_SECRET_KEY') &&
      getEnvOptional('STRIPE_PRICE_PRO_ANNUAL') &&
      getEnvOptional('STRIPE_PRICE_PRO_MONTHLY')
  );
}
