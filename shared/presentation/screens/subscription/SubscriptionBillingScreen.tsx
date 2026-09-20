import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, CheckCircle2, Zap, CreditCard, X, Shield, ArrowRight, Sparkles, Gift, Wallet } from 'lucide-react-native';
import { Colors } from '../../../core/theme/colors';
import { Typography } from '../../../core/theme/typography';
import { Spacing } from '../../../core/theme/spacing';
import { StatusBadge } from '../../components/StatusBadge';
import { SubscriptionPlan, UserSubscriptionStatus } from '../../../domain/models/Subscription';
import { SubscriptionRemoteDataSource } from '../../../data/datasources/SubscriptionRemoteDataSource';
import { SubscriptionRepositoryImpl } from '../../../data/repositories/SubscriptionRepositoryImpl';
import { CashfreeSdkService } from '../../../data/datasources/CashfreeSdkService';
import { PaymentProcessingScreen } from './PaymentProcessingScreen';
import { WalletBalanceWidget } from '../../components/WalletBalanceWidget';
import { WalletEvents } from '../../../core/utils/walletEvents';
import { useAuthStore } from '../../state/useAuthStore';

const subscriptionRepository = new SubscriptionRepositoryImpl(new SubscriptionRemoteDataSource());

interface SubscriptionBillingScreenProps {
  onClose: () => void;
}

export const SubscriptionBillingScreen: React.FC<SubscriptionBillingScreenProps> = ({ onClose }) => {
  const { activeRestaurant } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (globalThis as any).__MENZA_ACTIVE_REST_ID__ || 0;
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<UserSubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingPlanId, setPayingPlanId] = useState<number | null>(null);
  const [processingOrder, setProcessingOrder] = useState<{
    orderId: string;
    planName: string;
    amount: number;
    restaurantId: number;
    subscriptionConfigurationId: number;
  } | null>(null);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      let pData: SubscriptionPlan[] = [];
      let sData: UserSubscriptionStatus | null = null;

      try {
        pData = await subscriptionRepository.getPlans();
      } catch (err) {
        console.warn('Failed to load subscription plans from server', err);
        pData = [];
      }

      try {
        sData = await subscriptionRepository.getMySubscription();
      } catch (err) {
        console.warn('No active subscription found or error fetching active plan', err);
        sData = null;
      }

      setPlans(pData || []);
      setSubscription(sData);
    } catch (err) {
      console.warn('Error loading subscription data', err);
      setPlans([]);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  const isRenewingRef = React.useRef(false);

  const handleRenew = async (plan: SubscriptionPlan) => {
    if (isRenewingRef.current || payingPlanId !== null) return;
    const activeRestId = activeRestaurant?.restaurantId || (globalThis as any).__MENZA_ACTIVE_REST_ID__ || 0;
    if (!activeRestId) {
      Alert.alert('No Restaurant Selected', 'Please select a restaurant location first.');
      return;
    }
    const amount = plan.finalPrice ?? plan.price;

    const executeRenew = async () => {
      isRenewingRef.current = true;
      try {
        setPayingPlanId(plan.id);
        const res = await subscriptionRepository.initiateCashFreePayment(activeRestId, plan.id, amount);

        if (!res.success || !res.orderId) {
          Alert.alert('CashFree Payment Error', res.message || 'Could not initiate CashFree PG payment.');
          return;
        }

        setProcessingOrder({
          orderId: res.orderId,
          planName: plan.planName || plan.subscriptionName || 'SaaS Subscription Plan',
          amount,
          restaurantId: activeRestId,
          subscriptionConfigurationId: plan.id,
        });

        CashfreeSdkService.getInstance().startPayment({
          orderId: res.orderId,
          paymentSessionId: res.paymentSessionId || '',
          paymentLink: res.instrumentResponseUrl || '',
          environment: 'SANDBOX',
        }).catch((sdkErr) => {
          console.warn('CashFree Native SDK execution note:', sdkErr);
        });
      } catch (err: any) {
        Alert.alert('Payment Exception', err?.message || 'CashFree payment checkout failed.');
      } finally {
        setPayingPlanId(null);
        isRenewingRef.current = false;
      }
    };

    // If active subscription exists, inform the owner about renewal vs mid-cycle switch
    if (subscription && !subscription.isExpired && subscription.daysRemaining > 0) {
      const isSamePlan = subscription.subscriptionConfigurationId === plan.id;
      if (isSamePlan) {
        Alert.alert(
          'Renew Subscription Plan 🔄',
          `Renewing "${plan.planName || plan.subscriptionName}" will extend your current plan by ${plan.durationDays || plan.durationInDays || 30} days from your current expiry date (${new Date(subscription.endDate).toLocaleDateString()}). No days will be lost.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: `Renew & Pay ₹${amount.toLocaleString()}`, onPress: executeRenew }
          ]
        );
      } else {
        Alert.alert(
          'Switch Subscription Plan ⚡',
          `Switching to "${plan.planName || plan.subscriptionName}" will start immediately today. The remaining ${subscription.daysRemaining} days of your current plan will be prorated and refunded directly to your Store Wallet.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: `Switch & Pay ₹${amount.toLocaleString()}`, onPress: executeRenew }
          ]
        );
      }
      return;
    }

    await executeRenew();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />
      <View style={styles.container}>
        {/* TOP STREAMLINED UNIFIED HEADER (Identical to HomePage) */}
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <Image
              source={
                activeRestaurant?.logoUrl && activeRestaurant.logoUrl.trim().length > 0
                  ? { uri: activeRestaurant.logoUrl.trim() }
                  : (activeRestaurant as any)?.logo && (activeRestaurant as any).logo.trim().length > 0
                  ? { uri: (activeRestaurant as any).logo.trim() }
                  : require('../../../../assets/menza-logo.png')
              }
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.headerOutletTitle} numberOfLines={1}>
                {activeRestaurant?.restaurantName || 'Menza Bistro'}
              </Text>
              <Text style={styles.headerOutletSubtitle} numberOfLines={1}>
                SaaS Subscription • Plans & Billing
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeCircle}>
            <X size={16} color="#8C7A6B" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#DE8626" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Active Subscription Bento Card */}
            {subscription && (
              <View style={styles.activePlanCard}>
                <View style={styles.activePlanHeader}>
                  <View>
                    <Text style={styles.activePlanLabel}>CURRENT STORE PLAN</Text>
                    <Text style={styles.activePlanTitle}>{subscription.planName}</Text>
                  </View>
                  <StatusBadge label="ACTIVE TIER" variant="success" />
                </View>

                <View style={styles.countdownRow}>
                  <Text style={styles.countdownDays}>{subscription.daysRemaining}</Text>
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.countdownText}>Days Remaining in Billing Cycle</Text>
                    <Text style={styles.countdownExpiry}>Renews / Expire Date: {new Date(subscription.endDate).toLocaleDateString()}</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(10, (subscription.daysRemaining / 30) * 100))}%` }]} />
                </View>
              </View>
            )}

            {/* Prepaid Commission Wallet Card */}
            <View style={{ marginBottom: Spacing.md }}>
              <WalletBalanceWidget restaurantId={currentRestId} variant="card" />
            </View>

            {/* Included Entitlement Features */}
            <View style={styles.featuresCard}>
              <Text style={styles.featuresTitle}>Included Entitlement Features</Text>
              <View style={styles.featureList}>
                {[
                  'Counter POS Terminal & Cashier Billing',
                  'Kitchen Display System (KDS) & Printers',
                  'Live Floor Layout & Table Management',
                  'Staff Accounts, Shifts & Access PINs',
                  'Instant CashFree PG Gateway Integration',
                ].map((feat, idx) => (
                  <View key={`feat-item-${idx}`} style={styles.featureItem}>
                    <CheckCircle2 size={16} color="#17845A" />
                    <Text style={styles.featureText}>{feat}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Upgrade / Renewal Plans */}
            <Text style={styles.plansTitle}>Available Plans & Renewals</Text>
            {plans.map((plan) => {
              const finalPrice = plan.finalPrice ?? Math.max(0, plan.price - (plan.discountAmount || 0));
              const bonusCredit = plan.includedWalletCredit || 0;
              return (
                <View key={`sub-plan-${plan.id}`} style={styles.planCard}>
                  <View style={styles.planCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planName}>{plan.subscriptionName || plan.planName}</Text>
                      <Text style={styles.planDesc}>{plan.description || 'Full store feature entitlement tier'}</Text>
                      
                      {/* Commission & PG Benefit Badge */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A' }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400E' }}>
                            {plan.baseCommissionPercentage !== undefined && plan.baseCommissionPercentage > 0
                              ? `${plan.baseCommissionPercentage}% QR Commission`
                              : '0% Platform Commission'}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#A7F3D0' }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#065F46' }}>
                            🛡️ Menza Absorbs PG Fee
                          </Text>
                        </View>
                      </View>

                      {bonusCredit > 0 && (
                        <View style={styles.bonusWalletBadge}>
                          <Gift size={12} color="#17845A" />
                          <Text style={styles.bonusWalletText}>
                            Includes ₹{bonusCredit.toLocaleString('en-IN')} Free Wallet Credit
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.planPrice}>₹{finalPrice.toLocaleString()}</Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={styles.renewBtn}
                    onPress={() => handleRenew(plan)}
                    disabled={payingPlanId === plan.id}
                  >
                    <LinearGradient
                      colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.renewGradient}
                    >
                      {payingPlanId === plan.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <CreditCard size={16} color="#FFFFFF" />
                          <Text style={styles.renewBtnText}>
                            Pay ₹{finalPrice.toLocaleString()} via CashFree PG
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* CASHFREE PAYMENT PROCESSING OVERLAY */}
        {processingOrder && (
          <PaymentProcessingScreen
            visible={!!processingOrder}
            orderId={processingOrder.orderId}
            planName={processingOrder.planName}
            amount={processingOrder.amount}
            restaurantId={processingOrder.restaurantId}
            subscriptionConfigurationId={processingOrder.subscriptionConfigurationId}
            onSuccess={() => {
              WalletEvents.emit();
              loadSubscriptionData();
            }}
            onClose={() => {
              setProcessingOrder(null);
              WalletEvents.emit();
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 8,
    borderBottomWidth: 1.2,
    borderBottomColor: '#E7E1DA',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  headerOutletTitle: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerOutletSubtitle: {
    color: '#78716C',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  closeCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  activePlanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.card,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  activePlanHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  activePlanLabel: {
    color: '#D96B14',
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 1,
  },
  activePlanTitle: {
    color: '#1F2937',
    fontSize: 26,
    fontWeight: Typography.fontWeight.bold,
    marginTop: 2,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  countdownDays: {
    color: '#DE8626',
    fontSize: 36,
    fontWeight: Typography.fontWeight.bold,
  },
  countdownText: {
    color: '#1F2937',
    fontSize: Typography.fontSize.body2,
    fontWeight: Typography.fontWeight.bold,
  },
  countdownExpiry: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#EDE8E1',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#DE8626',
    borderRadius: 3,
  },
  featuresCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.card,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 1,
  },
  featuresTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
  },
  featureList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.body2,
  },
  plansTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    marginTop: Spacing.xs,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.card,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 1,
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  planName: {
    color: '#1F2937',
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
  },
  planDesc: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
  },
  planPrice: {
    color: '#DE8626',
    fontSize: 24,
    fontWeight: Typography.fontWeight.bold,
  },
  renewBtn: {
    borderRadius: Spacing.borderRadius.md,
    overflow: 'hidden',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  renewGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    gap: 8,
  },
  renewBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.body2,
    fontWeight: Typography.fontWeight.bold,
  },
  bonusWalletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E4F5EC',
    borderColor: 'rgba(23, 132, 90, 0.3)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  bonusWalletText: {
    color: '#17845A',
    fontSize: 11,
    fontWeight: Typography.fontWeight.bold,
  },
});


