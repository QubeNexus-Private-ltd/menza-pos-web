import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, AlertOctagon, Clock, ArrowRight, X, RefreshCw } from 'lucide-react-native';
import { useSubscriptionStore } from '../../state/useSubscriptionStore';

interface SubscriptionGraceBannerProps {
  onRenewPress?: () => void;
  style?: any;
}

export const SubscriptionGraceBanner: React.FC<SubscriptionGraceBannerProps> = ({
  onRenewPress,
  style,
}) => {
  const {
    subscription,
    lifecycleState,
    daysRemaining,
    isInGracePeriod,
    graceDaysRemaining,
    isExpired,
    openRenewalModal,
  } = useSubscriptionStore();

  const [dismissedExpiringSoon, setDismissedExpiringSoon] = useState(false);

  // If no subscription loaded yet, or active with > 3 days, don't show banner
  const isExpiringSoon = !isInGracePeriod && !isExpired && daysRemaining > 0 && daysRemaining <= 3;

  if (
    !subscription ||
    (!isInGracePeriod && !isExpired && !isExpiringSoon && lifecycleState !== 'PENDING')
  ) {
    return null;
  }

  if (isExpiringSoon && dismissedExpiringSoon) {
    return null;
  }

  const handlePress = () => {
    if (onRenewPress) {
      onRenewPress();
    } else {
      openRenewalModal();
    }
  };

  // Determine styling and message per scenario
  let bannerBg = '#FEF3C7';
  let bannerBorder = '#F59E0B';
  let textColor = '#92400E';
  let subtextColor = '#B45309';
  let title = '';
  let subtitle = '';
  let actionLabel = 'RENEW NOW';
  let IconComponent = AlertTriangle;
  let canDismiss = false;

  if (isExpired || lifecycleState === 'EXPIRED') {
    bannerBg = '#FEE2E2';
    bannerBorder = '#EF4444';
    textColor = '#991B1B';
    subtextColor = '#B91C1C';
    title = 'SUBSCRIPTION EXPIRED';
    subtitle = 'Grace period ended. Order placement is locked until your plan is renewed.';
    actionLabel = 'RENEW NOW';
    IconComponent = AlertOctagon;
    canDismiss = false;
  } else if (isInGracePeriod || lifecycleState === 'GRACE_PERIOD') {
    bannerBg = '#FFFBEB';
    bannerBorder = '#F59E0B';
    textColor = '#B45309';
    subtextColor = '#92400E';
    title = `GRACE PERIOD • ${graceDaysRemaining} DAY${graceDaysRemaining === 1 ? '' : 'S'} LEFT`;
    subtitle = 'Your plan has expired. Dining orders remain enabled during grace period, but will lock soon.';
    actionLabel = 'RENEW PLAN';
    IconComponent = Clock;
    canDismiss = false;
  } else if (lifecycleState === 'PENDING') {
    bannerBg = '#EFF6FF';
    bannerBorder = '#3B82F6';
    textColor = '#1E40AF';
    subtextColor = '#2563EB';
    title = 'PAYMENT PENDING CONFIRMATION';
    subtitle = 'A subscription payment order is currently pending verification.';
    actionLabel = 'CHECK STATUS';
    IconComponent = RefreshCw;
    canDismiss = false;
  } else if (isExpiringSoon) {
    bannerBg = '#FEF9C3';
    bannerBorder = '#EAB308';
    textColor = '#854D0E';
    subtextColor = '#A16207';
    title = `PLAN EXPIRES IN ${daysRemaining} DAY${daysRemaining === 1 ? '' : 'S'}`;
    subtitle = 'Extend your subscription now to ensure uninterrupted kitchen & table ordering operations.';
    actionLabel = 'EXTEND';
    IconComponent = AlertTriangle;
    canDismiss = true;
  }

  return (
    <View style={[styles.container, { backgroundColor: bannerBg, borderColor: bannerBorder }, style]}>
      <View style={styles.leftRow}>
        <View style={[styles.iconWrapper, { backgroundColor: `${bannerBorder}20` }]}>
          <IconComponent size={18} color={textColor} />
        </View>
        <View style={styles.textBlock}>
          <Text style={[styles.titleText, { color: textColor }]}>{title}</Text>
          <Text style={[styles.subtitleText, { color: subtextColor }]} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.rightRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: textColor }]}
          onPress={handlePress}
          activeOpacity={0.85}
        >
          <Text style={styles.actionBtnText}>{actionLabel}</Text>
          <ArrowRight size={13} color="#FFFFFF" />
        </TouchableOpacity>

        {canDismiss && (
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={() => setDismissedExpiringSoon(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={15} color={subtextColor} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginVertical: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  leftRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  textBlock: {
    flex: 1,
  },
  titleText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  subtitleText: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dismissBtn: {
    padding: 2,
  },
});
