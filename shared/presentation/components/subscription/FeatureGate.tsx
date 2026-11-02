import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Crown, ArrowRight, Sparkles, Smartphone } from 'lucide-react-native';
import { useSubscriptionStore } from '../../state/useSubscriptionStore';
import { MenzaApplicationKey, MenzaFeatureKey } from '../../../domain/models/Subscription';

interface FeatureGateProps {
  feature?: MenzaFeatureKey | string;
  appKey?: MenzaApplicationKey | string;
  title: string;
  description?: string;
  planSuggestion?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onUpgradePress?: () => void;
  onClose?: () => void;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  appKey = 'mobilePos',
  title,
  description,
  planSuggestion = 'Standard or Pro Plan',
  children,
  fallback,
  onUpgradePress,
  onClose,
}) => {
  const { isFeatureAllowed, isAppAllowed, openRenewalModal, hasLoaded } = useSubscriptionStore();

  // If subscription has not finished loading telemetry yet, render children to prevent layout flicker
  if (!hasLoaded) {
    return <>{children}</>;
  }

  // 1. Check Application Client Level Gate (e.g. mobilePos)
  if (appKey) {
    const isClientAllowed = isAppAllowed(appKey);
    if (!isClientAllowed) {
      if (fallback) return <>{fallback}</>;

      return (
        <View style={styles.gateContainer}>
          <View style={styles.gateCard}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
              <Smartphone size={32} color="#D97706" />
            </View>

            <View style={styles.badgeRow}>
              <Crown size={13} color="#D97706" />
              <Text style={styles.badgeText}>CLIENT APPLICATION LOCKED</Text>
            </View>

            <Text style={styles.gateTitle}>Mobile POS Not Licensed</Text>
            <Text style={styles.gateMessage}>
              Your restaurant's active subscription plan does not include Android / Mobile POS terminal access. Please upgrade your subscription plan to unlock mobile device access.
            </Text>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => (onUpgradePress ? onUpgradePress() : openRenewalModal())}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionButtonGradient}
              >
                <Sparkles size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Upgrade Subscription Plan</Text>
                <ArrowRight size={15} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            {onClose && (
              <TouchableOpacity onPress={onClose} style={styles.dismissButton} activeOpacity={0.75}>
                <Text style={styles.dismissButtonText}>Back to Dashboard</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }
  }

  // 2. Check Functional Feature Level Gate
  if (feature) {
    const isAllowed = isFeatureAllowed(feature);
    if (!isAllowed) {
      if (fallback) return <>{fallback}</>;

      return (
        <View style={styles.gateContainer}>
          <View style={styles.gateCard}>
            <View style={[styles.iconCircle, { backgroundColor: '#FFF4E5', borderColor: '#FFE4C4' }]}>
              <Lock size={32} color="#DE8626" />
            </View>

            <View style={styles.badgeRow}>
              <Crown size={13} color="#DE8626" />
              <Text style={styles.badgeText}>REQUIRES {planSuggestion.toUpperCase()}</Text>
            </View>

            <Text style={styles.gateTitle}>{title}</Text>
            <Text style={styles.gateMessage}>
              {description ||
                `The ${title} module is not included in your restaurant's active subscription plan. Upgrade your plan to unlock this functionality on your POS terminal.`}
            </Text>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => (onUpgradePress ? onUpgradePress() : openRenewalModal())}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionButtonGradient}
              >
                <Sparkles size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Upgrade Plan to Unlock</Text>
                <ArrowRight size={15} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            {onClose && (
              <TouchableOpacity onPress={onClose} style={styles.dismissButton} activeOpacity={0.75}>
                <Text style={styles.dismissButtonText}>Back to Dashboard</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  gateContainer: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  gateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    maxWidth: 440,
    width: '100%',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#FFF4E5',
    borderWidth: 1,
    borderColor: '#FEE2C5',
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9A5B10',
    letterSpacing: 0.5,
  },
  gateTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E2930',
    marginBottom: 8,
    textAlign: 'center',
  },
  gateMessage: {
    fontSize: 13,
    color: '#667085',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  actionButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dismissButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dismissButtonText: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '600',
  },
});
