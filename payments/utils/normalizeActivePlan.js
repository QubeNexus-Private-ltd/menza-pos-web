import {
  formatDate,
  getDaysRemaining,
} from '../../../utils/dateUtils';

import { pickFirst }
  from '../../../utils/helpers';

import {
  SUBSCRIPTION_STATUS,
} from '../../../constants/subscriptionStatus';

export const normalizeActivePlan = (
  payload
) => {
  const root =
    payload?.data ??
    payload?.result ??
    payload?.subscription ??
    payload?.plan ??
    payload;

  const data = Array.isArray(root)
    ? root[0]
    : root;

  if (
    !data ||
    typeof data !== 'object'
  ) {
    return null;
  }

  const config =
    data.subscriptionConfig ??
    data.config ??
    {};

  const subscriptionId =
    pickFirst(
      data.subscriptionId,
      data.planId,
      data.subscriptionConfigId,
      config.subscriptionId,
      config.planId,
      config.subscriptionConfigId,
      data.id,
      config.id
    );

  let status = String(
    pickFirst(
      data.status,
      config.status,
      SUBSCRIPTION_STATUS.ACTIVE
    )
  ).toUpperCase();

  const expiryDate =
    pickFirst(
      data.expiryDate,
      data.endDate,
      data.validTill,
      config.expiryDate,
      config.endDate,
      config.validTill
    );

  const startDate =
    pickFirst(
      data.startDate,
      data.appliedOn,
      config.startDate
    );

  // LOGIC FIX: If status is SCHEDULED but today is within the range, treat as ACTIVE
  const now = new Date();
  if (status === SUBSCRIPTION_STATUS.SCHEDULED && startDate && expiryDate) {
    const start = new Date(startDate);
    const end = new Date(expiryDate);
    if (now >= start && now <= end) {
      status = SUBSCRIPTION_STATUS.ACTIVE;
    }
  }

  const daysRemaining =
    getDaysRemaining(expiryDate);

  return {
    ...data,

    planId:
      subscriptionId == null
        ? null
        : String(subscriptionId),

    planTitle:
      pickFirst(
        data.subscriptionName,
        data.planName,
        config.subscriptionName,
        config.planName
      ) || 'Subscription',

    amount: Number(
      pickFirst(
        data.subscriptionAmount,
        data.amountPaid,
        config.subscriptionAmount,
        0
      )
    ),

    status,
    expiryDate,
    startDate,

    expiryDateText:
      formatDate(expiryDate),

    daysRemaining,

    isActive:
      status ===
      SUBSCRIPTION_STATUS.ACTIVE,

    isScheduled:
      status ===
      SUBSCRIPTION_STATUS.SCHEDULED,

    isExpired:
      status ===
      SUBSCRIPTION_STATUS.EXPIRED,
  };
};