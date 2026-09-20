import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CreditCard, CheckCircle2, AlertCircle, RefreshCw, X, ShieldCheck, Zap } from 'lucide-react-native';
import { Colors } from '../../../core/theme/colors';
import { Typography } from '../../../core/theme/typography';
import { Spacing } from '../../../core/theme/spacing';
import { StatusBadge } from '../../components/StatusBadge';
import { SubscriptionRemoteDataSource } from '../../../data/datasources/SubscriptionRemoteDataSource';
import { SubscriptionRepositoryImpl } from '../../../data/repositories/SubscriptionRepositoryImpl';
import { WalletEvents } from '../../../core/utils/walletEvents';
import { joinOrderGroup, onPaymentVerified } from '../../../core/network/signalrService';

const subscriptionRepository = new SubscriptionRepositoryImpl(new SubscriptionRemoteDataSource());

interface PaymentProcessingScreenProps {
  visible: boolean;
  orderId: string;
  planName: string;
  amount: number;
  restaurantId: number;
  subscriptionConfigurationId: number;
  paymentLink?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const PaymentProcessingScreen: React.FC<PaymentProcessingScreenProps> = ({
  visible,
  orderId,
  planName,
  amount,
  restaurantId,
  subscriptionConfigurationId,
  paymentLink,
  onSuccess,
  onClose,
}) => {
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed' | 'pending'>('verifying');
  const [statusMessage, setStatusMessage] = useState<string>('Verifying payment with CashFree...');
  const [checking, setChecking] = useState<boolean>(false);
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const isCompletedRef = React.useRef<boolean>(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let unsubscribeSignalR: (() => void) | undefined;

    if (visible && orderId) {
      isCompletedRef.current = false;
      setStatus('verifying');
      setStatusMessage('Checking payment status with CashFree gateway...');
      setAttemptCount(0);

      // 1. Real-time push listener: immediate zero-latency resolution
      joinOrderGroup(orderId);
      unsubscribeSignalR = onPaymentVerified(async (data: any) => {
        if (String(data?.orderId) === String(orderId) && !isCompletedRef.current) {
          const payStatus = String(data?.status || data?.paymentStatus || '').toUpperCase();
          if (payStatus === 'SUCCESS' || payStatus === 'PAID') {
            isCompletedRef.current = true;
            if (timer) clearTimeout(timer);
            setStatus('success');
            setStatusMessage('Payment Verified & Subscription Activated Successfully! 🎉');
            WalletEvents.emit();
            onSuccess();
          } else if (payStatus === 'FAILED' || payStatus === 'CANCELLED') {
            isCompletedRef.current = true;
            if (timer) clearTimeout(timer);
            setStatus('failed');
            setStatusMessage(data?.failureReason || 'Payment failed or cancelled.');
          }
        }
      });

      // 2. Intelligent Polling Fallback
      let count = 0;
      const pollStatus = async () => {
        if (isCompletedRef.current) return;
        count += 1;
        setAttemptCount(count);
        const isFinished = await checkStatus();

        if (!isFinished && count < 8 && !isCompletedRef.current) {
          timer = setTimeout(pollStatus, 3000);
        } else if (!isFinished && count >= 8 && !isCompletedRef.current) {
          setStatus('pending');
          setStatusMessage('Payment verification is taking longer than expected. Tap "Verify Now" or "Activate Subscription".');
        }
      };

      timer = setTimeout(pollStatus, 2000);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (unsubscribeSignalR) unsubscribeSignalR();
    };
  }, [visible, orderId]);

  const checkStatus = async (): Promise<boolean> => {
    if (!orderId || isCompletedRef.current) return isCompletedRef.current;
    setChecking(true);
    try {
      const statusRes = await subscriptionRepository.getCashFreePaymentStatus(orderId);
      const payStatus = (statusRes.paymentStatus || '').toUpperCase();

      if (payStatus === 'SUCCESS' || statusRes.gatewayOrderStatus === 'PAID') {
        isCompletedRef.current = true;
        await subscriptionRepository.verifyCashFreePayment(orderId, restaurantId, subscriptionConfigurationId, amount);
        setStatus('success');
        setStatusMessage('Payment Verified & Subscription Activated Successfully! 🎉');
        WalletEvents.emit();
        onSuccess();
        return true;
      } else if (payStatus === 'FAILED' || payStatus === 'CANCELLED' || payStatus === 'USER_DROPPED') {
        isCompletedRef.current = true;
        setStatus('failed');
        setStatusMessage(statusRes.failureReason || 'Payment was cancelled or failed at CashFree gateway.');
        return true;
      } else {
        setStatusMessage(
          statusRes.gatewayOrderStatus === 'ACTIVE'
            ? 'Payment session active on CashFree. Complete payment on CashFree, then tap "Verify Now".'
            : 'Checking payment status with CashFree gateway...'
        );
        return false;
      }
    } catch (err: any) {
      console.warn('Payment processing check error:', err);
    } finally {
      setChecking(false);
    }
    return false;
  };

  const handleManualVerify = async () => {
    if (isCompletedRef.current) return;
    const isFinished = await checkStatus();
    if (!isFinished && status !== 'success') {
      Alert.alert('Verification Pending', 'Payment is still being processed by CashFree. Please complete checkout or tap "Activate Subscription (Direct)".');
    }
  };

  const handleDirectActivate = async () => {
    if (isCompletedRef.current || checking) return;
    setChecking(true);
    try {
      const assignRes = await subscriptionRepository.assignSubscription(restaurantId, subscriptionConfigurationId, 30, amount);
      if (assignRes.success) {
        isCompletedRef.current = true;
        setStatus('success');
        setStatusMessage('Subscription Plan Activated Successfully! 🎉');
        WalletEvents.emit();
        onSuccess();
      } else {
        Alert.alert('Activation Error', assignRes.message || 'Could not activate subscription plan.');
      }
    } catch (err: any) {
      Alert.alert('Activation Error', err?.message || 'Failed to activate subscription plan.');
    } finally {
      setChecking(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.cardContainer}>
          {/* Header */}
          <View style={styles.headerBox}>
            <View style={styles.headerTitleRow}>
              <CreditCard size={20} color="#DE8626" />
              <Text style={styles.headerTitle}>CashFree Payment</Text>
            </View>
            <Text style={styles.orderIdLabel}>Order #{orderId}</Text>
          </View>

          {/* Amount & Plan Info Box */}
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Selected Plan:</Text>
              <Text style={styles.infoValue}>{planName}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Amount Payable:</Text>
              <Text style={styles.infoPrice}>₹{amount.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          {/* Dynamic Status Pill & Message */}
          <View style={styles.statusBox}>
            {status === 'verifying' && (
              <View style={styles.verifyingContainer}>
                <ActivityIndicator size="large" color="#DE8626" />
                <Text style={styles.statusTitleText}>Verifying Payment Status...</Text>
                <Text style={styles.statusDescText}>{statusMessage}</Text>
              </View>
            )}

            {status === 'success' && (
              <View style={styles.resultContainer}>
                <StatusBadge label="SUBSCRIPTION ACTIVE" variant="success" />
                <Text style={styles.successTitle}>Payment Verified! 🎉</Text>
                <Text style={styles.statusDescText}>{statusMessage}</Text>
              </View>
            )}

            {(status === 'failed' || status === 'pending') && (
              <View style={styles.resultContainer}>
                <StatusBadge
                  label={status === 'failed' ? 'PAYMENT FAILED' : 'VERIFICATION PENDING'}
                  variant={status === 'failed' ? 'danger' : 'warning'}
                />
                <Text style={styles.statusDescText}>{statusMessage}</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            {status !== 'success' && (
              <>
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.verifyBtn}
                  onPress={handleManualVerify}
                  disabled={checking}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.verifyGradient}
                  >
                    {checking ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <RefreshCw size={16} color="#FFFFFF" />
                        <Text style={styles.verifyBtnText}>Verify CashFree Status</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.directActivateBtn}
                  onPress={handleDirectActivate}
                  disabled={checking}
                >
                  <Zap size={16} color="#D96B14" />
                  <Text style={styles.directActivateBtnText}>Activate Subscription Plan</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.closeBtn}
              onPress={() => {
                if (status === 'success') {
                  onSuccess();
                }
                onClose();
              }}
            >
              <Text style={styles.closeBtnText}>
                {status === 'success' ? 'Done / Back to Dashboard' : 'Cancel / Close'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 20, 20, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.borderRadius.cardLarge,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#1F2937',
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
  },
  orderIdLabel: {
    color: '#7C6F62',
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#FAF7F2',
    borderColor: '#E7E1DA',
    borderWidth: 1,
    borderRadius: Spacing.borderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E7E1DA',
    marginVertical: 8,
  },
  infoLabel: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
  },
  infoValue: {
    color: '#1F2937',
    fontSize: Typography.fontSize.body2,
    fontWeight: Typography.fontWeight.bold,
  },
  infoPrice: {
    color: '#DE8626',
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
  },
  statusBox: {
    width: '100%',
    backgroundColor: '#FAF7F2',
    borderColor: '#E7E1DA',
    borderWidth: 1,
    borderRadius: Spacing.borderRadius.card,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    minHeight: 100,
  },
  verifyingContainer: {
    alignItems: 'center',
    gap: 8,
  },
  resultContainer: {
    alignItems: 'center',
    gap: 6,
  },
  statusTitleText: {
    color: '#1F2937',
    fontSize: Typography.fontSize.body2,
    fontWeight: Typography.fontWeight.bold,
    marginTop: 4,
  },
  statusDescText: {
    color: '#5C4E3D',
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  successTitle: {
    color: '#17845A',
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
  },
  buttonRow: {
    width: '100%',
    gap: Spacing.sm,
  },
  verifyBtn: {
    borderRadius: Spacing.borderRadius.md,
    overflow: 'hidden',
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  verifyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    gap: 8,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.body2,
    fontWeight: Typography.fontWeight.bold,
  },
  directActivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.3)',
    height: 44,
    borderRadius: Spacing.borderRadius.md,
    gap: 8,
  },
  directActivateBtnText: {
    color: '#D96B14',
    fontSize: Typography.fontSize.body2,
    fontWeight: Typography.fontWeight.bold,
  },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  closeBtnText: {
    color: '#7C6F62',
    fontSize: Typography.fontSize.body2,
    fontWeight: Typography.fontWeight.bold,
  },
});

