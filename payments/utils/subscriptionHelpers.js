import {
  SUBSCRIPTION_STATUS,
} from '../../../constants/subscriptionStatus';

export const isSubscriptionActive =
  (subscription) => {
    return (
      subscription?.status ===
      SUBSCRIPTION_STATUS.ACTIVE
    );
  };

export const isSubscriptionScheduled =
  (subscription) => {
    return (
      subscription?.status ===
      SUBSCRIPTION_STATUS.SCHEDULED
    );
  };

export const isSubscriptionExpired =
  (subscription) => {
    return (
      subscription?.status ===
      SUBSCRIPTION_STATUS.EXPIRED
    );
  };