import { createAdminClient } from '@/lib/supabase/admin';
import { FREE_INCLUDED_STAYS, type PlanId } from '@/lib/pricing';

export interface AccountUsage {
  plan: PlanId;
  used: number;
  limit: number;
  remaining: number;
  atLimit: boolean;
}

export class StayLimitReachedError extends Error {
  readonly code = 'limit_reached' as const;
  readonly plan: PlanId;
  readonly used: number;
  readonly limit: number;

  constructor(usage: AccountUsage) {
    super('Hosted stay limit reached');
    this.name = 'StayLimitReachedError';
    this.plan = usage.plan;
    this.used = usage.used;
    this.limit = usage.limit;
  }
}

export function toLimitReachedPayload(error: StayLimitReachedError) {
  return {
    error: error.code,
    plan: error.plan,
    used: error.used,
    limit: error.limit,
  };
}

export async function getAccountUsage(ownerId: string): Promise<AccountUsage> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('users')
    .select('plan, hosted_stays_used')
    .eq('id', ownerId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Owner account not found');
  }

  const plan = (data.plan as PlanId) ?? 'free';
  const used = data.hosted_stays_used ?? 0;
  const limit = FREE_INCLUDED_STAYS;
  const remaining = Math.max(0, limit - used);

  return {
    plan,
    used,
    limit,
    remaining,
    atLimit: plan === 'free' && used >= limit,
  };
}

export async function assertCanHostStay(ownerId: string): Promise<AccountUsage> {
  const usage = await getAccountUsage(ownerId);
  if (usage.atLimit) {
    throw new StayLimitReachedError(usage);
  }
  return usage;
}

export async function incrementHostedStays(ownerId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: current } = await admin
    .from('users')
    .select('hosted_stays_used')
    .eq('id', ownerId)
    .single();

  if (!current) {
    throw new Error('Owner account not found');
  }

  const { error } = await admin
    .from('users')
    .update({ hosted_stays_used: (current.hosted_stays_used ?? 0) + 1 })
    .eq('id', ownerId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getPropertyOwnerId(propertyId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('properties')
    .select('owner_id')
    .eq('id', propertyId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Property not found');
  }

  return data.owner_id;
}
