import { getGlobalProfile } from '../../apiClient';

const storagePrefix = 'homeorbit:v1:active-subscription:';
const memoryStore = new Map();

const getStorage = () => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  } catch (_error) {
    return null;
  }
  return null;
};

const pickFirst = (...values) => values.find((value) => (
  value !== undefined && value !== null && String(value).trim() !== ''
));

const getProfileKey = () => {
  const profile = getGlobalProfile() || {};
  const societyId = pickFirst(profile.societyId, profile.SocietyId, 'society');
  const ownerId = pickFirst(profile.ownerId, profile.OwnerId, 'owner');
  return `${societyId}:${ownerId}`;
};

const normalizePlanId = (planId) => (planId === undefined || planId === null ? null : String(planId));

export const getStoredActiveSubscription = () => {
  const key = getProfileKey();
  const memory = memoryStore.get(key);
  if (memory) return memory;

  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(`${storagePrefix}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    memoryStore.set(key, parsed);
    return parsed;
  } catch (_error) {
    return null;
  }
};

export const saveActiveSubscription = ({ plan, orderId, verifiedAt = new Date().toISOString() }) => {
  const key = getProfileKey();
  const planId = normalizePlanId(plan?.id ?? plan?.subscriptionId);
  if (!planId) return null;

  const noOfDays = Number(plan?.noOfDays);
  const expiresAt = Number.isFinite(noOfDays) && noOfDays > 0
    ? new Date(Date.now() + noOfDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const activeSubscription = {
    planId,
    subscriptionId: normalizePlanId(plan?.subscriptionId ?? plan?.id),
    planTitle: plan?.title,
    orderId,
    verifiedAt,
    expiresAt,
  };

  memoryStore.set(key, activeSubscription);

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(`${storagePrefix}${key}`, JSON.stringify(activeSubscription));
    } catch (_error) {
      // Persistence is best-effort; in-memory state still keeps this session correct.
    }
  }

  return activeSubscription;
};

export const clearStoredActiveSubscription = () => {
  const key = getProfileKey();
  memoryStore.delete(key);

  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(`${storagePrefix}${key}`);
  } catch (_error) {
    // Clearing stale subscription state is best-effort only.
  }
};

export const isSubscriptionActive = (subscription) => {
  if (!subscription?.planId) return false;
  if (!subscription.expiresAt) return true;
  return new Date(subscription.expiresAt).getTime() > Date.now();
};
