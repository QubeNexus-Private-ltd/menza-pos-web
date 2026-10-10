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
import { Crown, CheckCircle2, Zap, CreditCard, X, Shield, ArrowRight, Sparkles, Gift, Wallet, History } from 'lucide-react-native';
import { Colors } from '../../../core/theme/colors';
import { Typography } from '../../../core/theme/typography';
import { Spacing } from '../../../core/theme/spacing';
import { StatusBadge } from '../../components/StatusBadge';
import { SubscriptionPlan, UserSubscriptionStatus } from '../../../domain/models/Subscription';
import { SubscriptionRemoteDataSource } from '../../../data/datasources/SubscriptionRemoteDataSource';
import { SubscriptionRepositoryImpl } from '../../../data/repositories/SubscriptionRepositoryImpl';
import { PaymentGatewayManager } from '../../../data/datasources/PaymentGatewayManager';
import { PaymentProcessingScreen } from './PaymentProcessingScreen';
import { WalletBalanceWidget } from '../../components/WalletBalanceWidget';
import { WalletEvents } from '../../../core/utils/walletEvents';
import { useAuthStore } from '../../state/useAuthStore';
import { useSubscriptionStore, PlanChangeCalculation } from '../../state/useSubscriptionStore';
import { SubscriptionGraceBanner } from '../../components/subscription/SubscriptionGraceBanner';
import { SubscriptionRenewalModal } from '../../components/subscription/SubscriptionRenewalModal';

const subscriptionRepository = new SubscriptionRepositoryImpl(new SubscriptionRemoteDataSource());

interface SubscriptionBillingScreenProps {
  onClose: () => void;
}

export const SubscriptionBillingScreen: React.FC<SubscriptionBillingScreenProps> = ({ onClose }) => {
  const { activeRestaurant } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (globalThis as any).__MENZA_ACTIVE_REST_ID__ || 0;

  const {
    subscription,
    plans,
    history,
    isHistoryLoading,
    isLoading: storeLoading,
    fetchSubscriptionStatus,
    fetchPlans,
    fetchSubscriptionHistory,
    calculatePlanChange,
  } = useSubscriptionStore();

  const [loading, setLoading] = useState(true);
  const [payingPlanId, setPayingPlanId] = useState<number | null>(null);
  const [selectedPlanForRenewal, setSelectedPlanForRenewal] = useState<{
    plan: SubscriptionPlan;
    calculation: PlanChangeCalculation;
  } | null>(null);
  const [processingOrder, setProcessingOrder] = useState<{
    orderId: string;
    planName: string;
    amount: number;
    restaurantId: number;
    subscriptionConfigurationId: number;
    gateway?: string;
    paymentLink?: string;
    keyId?: string;
  } | null>(null);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchPlans(),
        fetchSubscriptionStatus(currentRestId),
        fetchSubscriptionHistory(currentRestId),
      ]);
    } catch (err) {
      console.warn('Error loading subscription data', err);
    } finally {
      setLoading(false);
    }
  };

  const isRenewingRef = React.useRef(false);

  const executeRenew = async (plan: SubscriptionPlan) => {
    if (isRenewingRef.current || payingPlanId !== null) return;
    const activeRestId = activeRestaurant?.restaurantId || (globalThis as any).__MENZA_ACTIVE_REST_ID__ || 0;
    if (!activeRestId) {
      Alert.alert('No Restaurant Selected', 'Please select a restaurant location first.');
      return;
    }
    const amount = plan.finalPrice ?? plan.price;

    isRenewingRef.current = true;
    try {
      setPayingPlanId(plan.id);
      const res = await subscriptionRepository.initiateCashFreePayment(activeRestId, plan.id, amount);

      if (!res.success || !res.orderId) {
        Alert.alert('Payment Initiation Error', res.message || 'Could not initiate payment order.');
        return;
      }

      setProcessingOrder({
        orderId: res.orderId,
        planName: plan.planName || plan.subscriptionName || 'SaaS Subscription Plan',
        amount,
        restaurantId: activeRestId,
        subscriptionConfigurationId: plan.id,
        gateway: res.gateway,
        paymentLink: res.instrumentResponseUrl,
        keyId: res.keyId,
      });

      let paymentResult: any = null;
      try {
        paymentResult = await PaymentGatewayManager.getInstance().startPayment({
          orderId: res.orderId,
          paymentSessionId: res.paymentSessionId || '',
          paymentLink: res.instrumentResponseUrl || '',
          gateway: res.gateway,
          keyId: res.keyId,
          amount,
          currency: res.currency || 'INR',
          customerName: activeRestaurant?.restaurantName || 'Restaurant Owner',
          customerPhone: activeRestaurant?.ownerMobile || '9999999999',
          customerEmail: (activeRestaurant as any)?.email || 'billing@menza.com',
          orderNotes: `Subscription Plan: ${plan.planName || plan.subscriptionName}`,
          environment: 'SANDBOX',
        });
      } catch (sdkErr) {
        console.warn('Payment execution note:', sdkErr);
      }

      // Immediately verify and activate subscription (aligned with Wallet Recharge flow)
      if (paymentResult?.razorpayPaymentId || paymentResult?.razorpaySignature) {
        try {
          await subscriptionRepository.verifyCashFreePayment(
            res.orderId,
            activeRestId,
            plan.id,
            amount,
            paymentResult.razorpayPaymentId,
            paymentResult.razorpaySignature
          );
        } catch (vErr) {
          console.warn('Subscription auto-verify note:', vErr);
        }
      }
    } catch (err: any) {
      Alert.alert('Payment Exception', err?.message || 'Payment checkout failed.');
    } finally {
      setPayingPlanId(null);
      isRenewingRef.current = false;
    }
  };

  const handleRenew = (plan: SubscriptionPlan) => {
    const activeRestId = activeRestaurant?.restaurantId || (globalThis as any).__MENZA_ACTIVE_REST_ID__ || 0;
    if (!activeRestId) {
      Alert.alert('No Restaurant Selected', 'Please select a restaurant location first.');
      return;
    }
    const calc = calculatePlanChange(plan);
    setSelectedPlanForRenewal({ plan, calculation: calc });
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

        {/* Global Grace Period / Expiration Alert Banner */}
        <SubscriptionGraceBanner style={{ marginHorizontal: 0, marginBottom: 8 }} />

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#DE8626" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Active Subscription Bento Card */}
            {subscription && (
              <View
                style={[
                  styles.activePlanCard,
                  subscription.isExpired && { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
                  subscription.isInGracePeriod && { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
                ]}
              >
                <View style={styles.activePlanHeader}>
                  <View>
                    <Text style={styles.activePlanLabel}>CURRENT STORE PLAN</Text>
                    <Text style={styles.activePlanTitle}>{subscription.planName}</Text>
                  </View>
                  <StatusBadge
                    label={
                      subscription.isExpired
                        ? 'EXPIRED'
                        : subscription.isInGracePeriod
                        ? `GRACE PERIOD (${subscription.graceDaysRemaining}d)`
                        : subscription.hasQueuedRenewal
                        ? 'ACTIVE • RENEWED'
                        : subscription.lifecycleState === 'PENDING'
                        ? 'PENDING'
                        : 'ACTIVE TIER'
                    }
                    variant={
                      subscription.isExpired
                        ? 'danger'
                        : subscription.isInGracePeriod
                        ? 'warning'
                        : subscription.lifecycleState === 'PENDING'
                        ? 'info'
                        : 'success'
                    }
                  />
                </View>

                <View style={styles.countdownRow}>
                  <Text
                    style={[
                      styles.countdownDays,
                      subscription.isExpired && { color: '#DC2626' },
                      subscription.isInGracePeriod && { color: '#D97706' },
                      subscription.hasQueuedRenewal && { color: '#059669' },
                    ]}
                  >
                    {subscription.isInGracePeriod
                      ? subscription.graceDaysRemaining
                      : subscription.isExpired
                      ? 0
                      : subscription.totalDaysRemaining ?? subscription.daysRemaining}
                  </Text>
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={styles.countdownText}>
                      {subscription.isInGracePeriod
                        ? 'Grace Period Days Remaining'
                        : subscription.isExpired
                        ? 'Subscription Expired'
                        : subscription.hasQueuedRenewal
                        ? 'Total Days Paid & Covered'
                        : 'Days Remaining in Billing Cycle'}
                    </Text>
                    <Text style={styles.countdownExpiry}>
                      {subscription.isExpired
                        ? `Expired on: ${new Date(subscription.endDate).toLocaleDateString()}`
                        : subscription.hasQueuedRenewal
                        ? `Current cycle: ${subscription.currentCycleDaysRemaining ?? subscription.daysRemaining}d • Covered until: ${new Date(subscription.effectiveCoverageEndDate || subscription.endDate).toLocaleDateString()}`
                        : `Renews / Expire Date: ${new Date(subscription.endDate).toLocaleDateString()}`}
                    </Text>
                  </View>
                </View>

                {subscription.hasQueuedRenewal && (
                  <View style={styles.renewalQueuedCard}>
                    <Sparkles size={14} color="#059669" />
                    <Text style={styles.renewalQueuedText}>
                      Next 30-day renewal cycle is confirmed & queued. Takes effect seamlessly on {new Date(subscription.endDate).toLocaleDateString()} with zero disruption.
                    </Text>
                  </View>
                )}

                {/* Progress Bar */}
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      subscription.isExpired && { backgroundColor: '#EF4444', width: '100%' },
                      subscription.isInGracePeriod && {
                        backgroundColor: '#F59E0B',
                        width: `${Math.max(15, ((subscription.graceDaysRemaining ?? 0) / 3) * 100)}%`,
                      },
                      !subscription.isExpired &&
                        !subscription.isInGracePeriod && {
                          backgroundColor: subscription.hasQueuedRenewal ? '#10B981' : '#DE8626',
                          width: subscription.hasQueuedRenewal
                            ? '100%'
                            : `${Math.min(100, Math.max(10, (subscription.daysRemaining / 30) * 100))}%`,
                        },
                    ]}
                  />
                </View>
              </View>
            )}

            {/* Prepaid Platform Fee Wallet Card */}
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
                  'Instant Online Payment Gateway Integration',
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
              const isCurrentPlan = subscription?.subscriptionConfigurationId === plan.id;

              return (
                <View
                  key={`sub-plan-${plan.id}`}
                  style={[
                    styles.planCard,
                    isCurrentPlan && { borderColor: '#10B981', borderWidth: 1.5, backgroundColor: '#F0FDF4' },
                  ]}
                >
                  <View style={styles.planCardHeader}>
                    <View style={{ flex: 1 }}>
                      {isCurrentPlan && (
                        <View style={styles.currentActiveBadge}>
                          <CheckCircle2 size={12} color="#15803D" />
                          <Text style={styles.currentActiveBadgeText}>CURRENT ACTIVE PLAN</Text>
                        </View>
                      )}
                      <Text style={styles.planName}>{plan.subscriptionName || plan.planName}</Text>
                      <Text style={styles.planDesc}>{plan.description || 'Full store feature entitlement tier'}</Text>
                      
                      {/* Platform Fee & PG Benefit Badge */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A' }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400E' }}>
                            {plan.baseCommissionPercentage !== undefined && plan.baseCommissionPercentage > 0
                              ? `${plan.baseCommissionPercentage}% QR Platform Fee`
                              : '0% Platform Fee'}
                            {plan.minCommissionFloorPerOrder && plan.minCommissionFloorPerOrder > 0
                              ? ` (Min ₹${plan.minCommissionFloorPerOrder})`
                              : ''}
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
                      colors={
                        isCurrentPlan
                          ? ['#059669', '#10B981']
                          : ['#F59E0B', '#E58B24', '#DE8626', '#CB741B']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.renewGradient}
                    >
                      {payingPlanId === plan.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : isCurrentPlan ? (
                        <>
                          <CheckCircle2 size={16} color="#FFFFFF" />
                          <Text style={styles.renewBtnText}>
                            {subscription?.hasQueuedRenewal
                              ? `Plan Extended (${subscription.totalDaysRemaining}d) • Stack +30d (₹${finalPrice.toLocaleString()})`
                              : `Renew Current Plan (₹${finalPrice.toLocaleString()})`}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} color="#FFFFFF" />
                          <Text style={styles.renewBtnText}>
                            Upgrade to {plan.subscriptionName || plan.planName} (₹{finalPrice.toLocaleString()})
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Subscription & Lifecycle History */}
            <View style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <History size={18} color="#DE8626" />
                  <Text style={styles.historyTitle}>Subscription & Billing History</Text>
                </View>
                {history.length > 0 && (
                  <View style={styles.historyCountBadge}>
                    <Text style={styles.historyCountText}>{history.length} {history.length === 1 ? 'event' : 'events'}</Text>
                  </View>
                )}
              </View>

              {isHistoryLoading ? (
                <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#F59E0B" />
                  <Text style={{ fontSize: 12, color: '#8C7E72', marginTop: 6 }}>Loading history...</Text>
                </View>
              ) : history.length === 0 ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#8C7E72' }}>No subscription history recorded yet.</Text>
                </View>
              ) : (
                <View style={styles.timelineContainer}>
                  {history.map((item, index) => {
                    const isLast = index === history.length - 1;
                    const getEventBadge = (type: string) => {
                      switch (type?.toUpperCase()) {
                        case 'ACTIVATED':
                          return { bg: '#DCFCE7', text: '#15803D', label: 'Activated' };
                        case 'PURCHASED':
                          return { bg: '#EFF6FF', text: '#1D4ED8', label: 'Purchased' };
                        case 'RENEWED':
                          return { bg: '#F3E8FF', text: '#7E22CE', label: 'Renewed' };
                        case 'UPGRADED':
                          return { bg: '#FEF3C7', text: '#B45309', label: 'Upgraded' };
                        case 'GRACE_PERIOD_STARTED':
                          return { bg: '#FFEDD5', text: '#C2410C', label: 'Grace Period' };
                        case 'EXPIRED':
                          return { bg: '#FEE2E2', text: '#B91C1C', label: 'Expired' };
                        case 'CANCELLED':
                          return { bg: '#F3F4F6', text: '#4B5563', label: 'Cancelled' };
                        default:
                          return { bg: '#F3F4F6', text: '#374151', label: type || 'Status Update' };
                      }
                    };
                    const badge = getEventBadge(item.eventType);

                    return (
                      <View key={`hist-${item.id}-${index}`} style={styles.timelineItem}>
                        <View style={styles.timelineLeftColumn}>
                          <View
                            style={[
                              styles.timelineDot,
                              { backgroundColor: badge.text },
                            ]}
                          />
                          {!isLast && <View style={styles.timelineLine} />}
                        </View>

                        <View style={styles.timelineContent}>
                          <View style={styles.timelineRowTop}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                              <Text style={styles.timelinePlanName}>
                                {item.subscriptionName || item.subscriptionCode || 'Subscription Plan'}
                              </Text>
                              <View style={[styles.eventBadge, { backgroundColor: badge.bg }]}>
                                <Text style={[styles.eventBadgeText, { color: badge.text }]}>
                                  {badge.label}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.timelineDate}>
                              {item.createdDateUtc ? new Date(item.createdDateUtc).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              }) : ''}
                            </Text>
                          </View>

                          {/* Remarks / Details */}
                          {item.remarks && (
                            <Text style={styles.timelineRemarks}>{item.remarks}</Text>
                          )}

                          {/* Upgrade & Proration Details */}
                          {item.proratedRefundAmount !== undefined && item.proratedRefundAmount !== null && item.proratedRefundAmount > 0 && (
                            <View style={styles.prorationCard}>
                              <Sparkles size={12} color="#059669" />
                              <Text style={styles.prorationText}>
                                Prorated Wallet Credit: ₹{item.proratedRefundAmount.toLocaleString('en-IN')}
                              </Text>
                            </View>
                          )}

                          {/* Metadata Chips: Amount, Period, Source */}
                          <View style={styles.timelineChipsRow}>
                            {item.amountPaid > 0 && (
                              <View style={styles.timelineChip}>
                                <CreditCard size={11} color="#6B7280" />
                                <Text style={styles.timelineChipText}>₹{item.amountPaid.toLocaleString('en-IN')}</Text>
                              </View>
                            )}
                            {item.startDate && item.endDate && (
                              <View style={styles.timelineChip}>
                                <Text style={styles.timelineChipText}>
                                  {new Date(item.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(item.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </Text>
                              </View>
                            )}
                            {item.actionSource && (
                              <View style={styles.timelineChip}>
                                <Text style={styles.timelineChipText}>{item.actionSource}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {/* PAYMENT PROCESSING OVERLAY */}
        {processingOrder && (
          <PaymentProcessingScreen
            visible={!!processingOrder}
            orderId={processingOrder.orderId}
            planName={processingOrder.planName}
            amount={processingOrder.amount}
            restaurantId={processingOrder.restaurantId}
            subscriptionConfigurationId={processingOrder.subscriptionConfigurationId}
            paymentLink={processingOrder.paymentLink}
            gateway={processingOrder.gateway}
            keyId={processingOrder.keyId}
            onSuccess={() => {
              WalletEvents.emit();
              loadSubscriptionData();
            }}
            onClose={() => {
              setProcessingOrder(null);
              WalletEvents.emit();
              loadSubscriptionData();
            }}
          />
        )}

        {/* SUBSCRIPTION RENEWAL / UPGRADE CONFIRMATION BREAKDOWN MODAL */}
        {selectedPlanForRenewal && (
          <SubscriptionRenewalModal
            visible={!!selectedPlanForRenewal}
            onClose={() => setSelectedPlanForRenewal(null)}
            plan={selectedPlanForRenewal.plan}
            currentSubscription={subscription}
            calculation={selectedPlanForRenewal.calculation}
            onConfirmPay={async (planToPay) => {
              setSelectedPlanForRenewal(null);
              await executeRenew(planToPay);
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
  currentActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  currentActiveBadgeText: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  renewalQueuedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
    marginTop: 10,
  },
  renewalQueuedText: {
    flex: 1,
    color: '#065F46',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.card,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EFEA',
    marginBottom: Spacing.sm,
  },
  historyTitle: {
    fontSize: Typography.fontSize.body1,
    fontWeight: Typography.fontWeight.bold,
    color: '#1F2937',
  },
  historyCountBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  historyCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  timelineContainer: {
    paddingTop: Spacing.xs,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  timelineLeftColumn: {
    width: 20,
    alignItems: 'center',
    marginRight: 10,
    paddingTop: 4,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 4,
    minHeight: 40,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timelineRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timelinePlanName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  eventBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  eventBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timelineDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  timelineRemarks: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 4,
  },
  prorationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
    marginVertical: 4,
  },
  prorationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
  },
  timelineChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  timelineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  timelineChipText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
});


