import API, { getGlobalProfile, getGlobalSocietyId } from '../../apiClient';
import { withApiError } from '../../apiError';
import { pickFirst } from '../../../utils/helpers';

const fallbackBilling = (config = {}) => {
  const noOfDays = Number(config.noOfDays ?? config.NoOfDays);
  if (Number.isFinite(noOfDays) && noOfDays > 0) {
    if (noOfDays <= 31) return 'mo';
    if (noOfDays >= 360) return 'yr';
    return `${noOfDays}d`;
  }

  const duration = String(
    config.billing ??
    config.Billing ??
    config.duration ??
    config.Duration ??
    config.billingCycle ??
    config.BillingCycle ??
    config.subscriptionType ??
    ''
  ).toLowerCase();

  if (duration.includes('month')) return 'mo';
  if (duration.includes('year') || duration.includes('annual')) return 'yr';
  return duration || 'yr';
};

const getOriginalAmount = (config = {}, amount = 0) => {
  const explicit = Number(
    config.originalAmount ??
    config.OriginalAmount ??
    config.mrp ??
    config.Mrp ??
    config.regularAmount ??
    config.RegularAmount
  );

  if (Number.isFinite(explicit) && explicit > amount) return explicit;

  const discount = Number(config.subscriptionDiscount ?? config.SubscriptionDiscount ?? config.discount ?? config.Discount ?? 0);
  if (Number.isFinite(discount) && discount > 0) {
    if (discount < 100) return Math.round(amount / (1 - (discount / 100)));
    return amount + discount;
  }

  return Math.ceil((amount * 1.25) / 10) * 10;
};

const normalizePlan = (config = {}, index = 0) => {
  const id = config.id ?? config.Id ?? config.subscriptionConfigId ?? config.SubscriptionConfigId ?? config.subscriptionId ?? config.SubscriptionId ?? index + 1;
  const title = config.title ?? config.Title ?? config.name ?? config.Name ?? config.planName ?? config.PlanName ?? config.subscriptionName ?? config.SubscriptionName ?? `Plan ${index + 1}`;
  const amount = Number(config.amount ?? config.Amount ?? config.price ?? config.Price ?? config.subscriptionAmount ?? config.SubscriptionAmount ?? 0);
  const originalAmount = getOriginalAmount(config, amount);
  const savingsAmount = Math.max(originalAmount - amount, 0);
  const savingsPercent = originalAmount > 0 ? Math.round((savingsAmount / originalAmount) * 100) : 0;
  const noOfDays = config.noOfDays ?? config.NoOfDays;

  return {
    ...config,
    id: String(id),
    subscriptionId: id,
    title: String(title),
    amount,
    originalAmount,
    savingsAmount,
    savingsPercent,
    noOfDays,
    billing: fallbackBilling(config),
    badge: config.badge ?? config.Badge ?? config.tag ?? config.Tag ?? (savingsPercent > 0 ? `Save ${savingsPercent}%` : undefined),
    desc: String(
      config.desc ??
      config.description ??
      config.Description ??
      config.subscriptionDescription ??
      config.SubscriptionDescription ??
      config.details ??
      config.Details ??
      'HomeOrbit subscription plan.'
    ),
  };
};

const toPlans = (payload) => {
  const data = payload?.data ?? payload?.result ?? payload?.items ?? payload;
  const rows = Array.isArray(data)
    ? data
    : data?.subscriptionConfigs ?? data?.SubscriptionConfigs ?? data?.plans ?? data?.Plans ?? data?.items ?? data?.Items ?? [];

  return Array.isArray(rows)
    ? rows.map(normalizePlan).filter((plan) => plan.amount > 0)
    : [];
};

export const getSubscriptionConfig = async () => {
  const profile = getGlobalProfile() || {};
  const societyId = pickFirst(profile.societyId, profile.SocietyId, getGlobalSocietyId(), 1);

  const candidates = [
    '/SubscriptionConfig',
    '/SubscriptionConfigs',
    '/SubscriptionPlan',
    '/SubscriptionPlans',
    `/SocietySubscription/${societyId}/config`,
    `/SocietySubscription/config`,
  ];

  for (const url of candidates) {
    try {
      const response = await API.get(url);
      const plans = toPlans(response.data);
      if (plans && plans.length > 0) return plans;
    } catch (error) {
      if (error?.response?.status !== 404) break;
    }
  }

  return [];
};
