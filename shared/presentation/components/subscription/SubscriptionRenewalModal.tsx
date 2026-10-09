import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  CreditCard,
  Sparkles,
  Calendar,
  Gift,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Wallet,
  Clock,
  RotateCcw,
} from 'lucide-react-native';
import { SubscriptionPlan, UserSubscriptionStatus, PlanChangeType } from '../../../domain/models/Subscription';
import { PlanChangeCalculation } from '../../state/useSubscriptionStore';

interface SubscriptionRenewalModalProps {
  visible: boolean;
  onClose: () => void;
  plan: SubscriptionPlan;
  currentSubscription: UserSubscriptionStatus | null;
  calculation: PlanChangeCalculation;
  onConfirmPay: (plan: SubscriptionPlan) => Promise<void>;
}

export const SubscriptionRenewalModal: React.FC<SubscriptionRenewalModalProps> = ({
  visible,
  onClose,
  plan,
  currentSubscription,
  calculation,
  onConfirmPay,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!visible) return null;

  const finalPrice = plan.finalPrice ?? Math.max(0, plan.price - (plan.discountAmount || 0));
  const taxAmount = Math.round(finalPrice * 0.18 * 100) / 100;
  const totalPayable = finalPrice + taxAmount;
  const bonusWalletCredit = plan.includedWalletCredit || 0;

  const handlePayPress = async () => {
    try {
      setIsSubmitting(true);
      await onConfirmPay(plan);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRenew = calculation.changeType === 'RENEW';
  const isUpgrade = calculation.changeType === 'UPGRADE';
  const isFresh = calculation.changeType === 'FRESH';

  const newExpiryFormatted = calculation.newExpiryDate
    ? new Date(calculation.newExpiryDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  const currentExpiryFormatted = currentSubscription?.endDate
    ? new Date(currentSubscription.endDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.headerBadge}>
                {isRenew ? '🔄 PLAN RENEWAL' : isUpgrade ? '⚡ PLAN UPGRADE' : '✨ PLAN ACTIVATION'}
              </Text>
              <Text style={styles.modalTitle}>{plan.subscriptionName || plan.planName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={isSubmitting}>
              <X size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            {/* Scenario Explainer Card */}
            {isRenew && (
              <View style={[styles.infoBanner, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <RotateCcw size={18} color="#059669" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.infoBannerTitle, { color: '#065F46' }]}>
                    Continuous Date Extension
                  </Text>
                  <Text style={[styles.infoBannerDesc, { color: '#047857' }]}>
                    This renewal seamlessly appends {calculation.durationDays} days onto your current expiry date ({currentExpiryFormatted}). No days are lost!
                  </Text>
                </View>
              </View>
            )}

            {isUpgrade && (
              <View style={[styles.infoBanner, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                <Sparkles size={18} color="#2563EB" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.infoBannerTitle, { color: '#1E40AF' }]}>
                    Immediate Upgrade with Wallet Refund
                  </Text>
                  <Text style={[styles.infoBannerDesc, { color: '#1D4ED8' }]}>
                    Starts immediately today. The {currentSubscription?.daysRemaining} remaining days of your current plan will be prorated (approx ₹{calculation.proratedRefund.toLocaleString('en-IN')}) and refunded to your Store Wallet.
                  </Text>
                </View>
              </View>
            )}

            {isFresh && currentSubscription?.isInGracePeriod && (
              <View style={[styles.infoBanner, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                <Clock size={18} color="#D97706" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.infoBannerTitle, { color: '#92400E' }]}>
                    Grace Period Resolution
                  </Text>
                  <Text style={[styles.infoBannerDesc, { color: '#B45309' }]}>
                    Activating now resets your billing cycle for {calculation.durationDays} full days from today and removes all grace period restrictions.
                  </Text>
                </View>
              </View>
            )}

            {/* Billing Timeline Breakdown */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Billing Timeline</Text>
              <View style={styles.timelineRow}>
                <Calendar size={16} color="#4B5563" />
                <Text style={styles.timelineLabel}>New Expiry Date:</Text>
                <Text style={styles.timelineValue}>{newExpiryFormatted}</Text>
              </View>
              <View style={styles.timelineRow}>
                <Clock size={16} color="#4B5563" />
                <Text style={styles.timelineLabel}>Plan Duration:</Text>
                <Text style={styles.timelineValue}>{calculation.durationDays} Days</Text>
              </View>
            </View>

            {/* Wallet Bonus & PG Protection */}
            <View style={styles.benefitsRow}>
              {bonusWalletCredit > 0 && (
                <View style={styles.benefitBadge}>
                  <Gift size={14} color="#15803D" />
                  <Text style={styles.benefitText}>
                    +₹{bonusWalletCredit.toLocaleString('en-IN')} Wallet Bonus
                  </Text>
                </View>
              )}
              <View style={[styles.benefitBadge, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}>
                <ShieldCheck size={14} color="#1D4ED8" />
                <Text style={[styles.benefitText, { color: '#1E40AF' }]}>
                  Menza Absorbs PG Fee
                </Text>
              </View>
            </View>

            {/* Pricing Summary Breakdown */}
            <View style={styles.priceBreakdownCard}>
              <Text style={styles.sectionHeader}>Payment Summary</Text>

              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Base Plan Price ({calculation.durationDays} days)</Text>
                <Text style={styles.priceValue}>₹{finalPrice.toLocaleString('en-IN')}</Text>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>GST (18% Goods & Services Tax)</Text>
                <Text style={styles.priceValue}>₹{taxAmount.toLocaleString('en-IN')}</Text>
              </View>

              {isUpgrade && calculation.proratedRefund > 0 && (
                <View style={[styles.priceRow, { borderTopWidth: 1, borderColor: '#E5E7EB', paddingTop: 6, marginTop: 4 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Wallet size={14} color="#059669" />
                    <Text style={[styles.priceLabel, { color: '#059669', fontWeight: '600' }]}>
                      Prorated Wallet Credit Back
                    </Text>
                  </View>
                  <Text style={[styles.priceValue, { color: '#059669', fontWeight: '700' }]}>
                    +₹{calculation.proratedRefund.toLocaleString('en-IN')}
                  </Text>
                </View>
              )}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Payable</Text>
                <Text style={styles.totalValue}>₹{totalPayable.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelBtnText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.payBtn}
              onPress={handlePayPress}
              disabled={isSubmitting}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.payBtnGradient}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <CreditCard size={16} color="#FFFFFF" />
                    <Text style={styles.payBtnText}>
                      Pay ₹{totalPayable.toLocaleString('en-IN')} Online
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bodyScroll: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
  },
  infoBanner: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoBannerDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  timelineLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
  timelineValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  benefitsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  benefitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  benefitText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  priceBreakdownCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  priceLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#DE8626',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  payBtn: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  payBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
