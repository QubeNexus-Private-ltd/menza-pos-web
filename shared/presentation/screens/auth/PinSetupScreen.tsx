import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Delete,
  Eye,
  EyeOff,
  KeyRound,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import { useAuthStore } from '../../state/useAuthStore';
import { logger } from '../../../core/logging';
import { TermsAndConditionsModal } from '../legal/TermsAndConditionsModal';
import { PrivacyPolicyModal } from '../legal/PrivacyPolicyModal';

const KEY_SUB_LABELS: Record<string, string> = {
  '1': '',
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ',
  '0': '+',
};

export const PinSetupScreen: React.FC = () => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [activePinField, setActivePinField] = useState<'pin' | 'confirmPin'>('pin');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);

  const completePinSetup = useAuthStore((state) => state.completePinSetup);
  const activeStaffName = useAuthStore((state) => state.activeStaffName);
  const user = useAuthStore((state) => state.user);

  const isTablet = Math.min(windowWidth, windowHeight) >= 600;
  const cardWidth = isTablet ? 420 : Math.min(windowWidth - 32, 380);

  const handlePinDigitPress = (digit: string) => {
    if (errorMsg) setErrorMsg(null);
    if (activePinField === 'pin') {
      if (pin.length < 4) {
        const nextPin = pin + digit;
        setPin(nextPin);
        if (nextPin.length === 4) {
          setTimeout(() => {
            setActivePinField('confirmPin');
          }, 150);
        }
      }
    } else {
      if (confirmPin.length < 4) {
        const nextConfirm = confirmPin + digit;
        setConfirmPin(nextConfirm);
      }
    }
  };

  const handlePinDelete = () => {
    if (errorMsg) setErrorMsg(null);
    if (activePinField === 'confirmPin') {
      if (confirmPin.length > 0) {
        setConfirmPin(confirmPin.slice(0, -1));
      } else {
        setActivePinField('pin');
      }
    } else {
      if (pin.length > 0) {
        setPin(pin.slice(0, -1));
      }
    }
  };

  const handlePinClear = () => {
    if (errorMsg) setErrorMsg(null);
    if (activePinField === 'confirmPin') {
      setConfirmPin('');
    } else {
      setPin('');
    }
  };

  const handleSubmit = async () => {
    if (loading) return;

    if (pin.length !== 4) {
      setErrorMsg('Please enter a 4-digit PIN.');
      return;
    }
    if (confirmPin.length !== 4) {
      setErrorMsg('Please confirm your 4-digit PIN.');
      return;
    }
    if (pin !== confirmPin) {
      setErrorMsg('PINs do not match. Please re-enter.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      logger.auth('STAFF_PIN_CONFIGURED', 'Submitting initial staff PIN');
      const success = await completePinSetup(pin);
      if (!success) {
        setErrorMsg('Failed to save PIN. Please try again.');
      }
    } catch (err: any) {
      logger.auth('POS_PIN_UNLOCK_FAILED', 'Failed to save staff PIN', { error: err?.message });
      setErrorMsg(err?.message || 'Failed to save PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    logger.auth('STAFF_PIN_CONFIGURED', 'User skipped first-time PIN configuration; defaulting to 1234');
    useAuthStore.setState({
      isPinLocked: false,
      isPinConfigured: true,
      authMode: 'pin',
    });
  };

  const displayName = activeStaffName || user?.name || 'Operator';

  const renderNumericKeypad = () => {
    const canClear = activePinField === 'pin' ? pin.length > 0 : confirmPin.length > 0;
    const canDelete = activePinField === 'pin' ? pin.length > 0 : confirmPin.length > 0;

    return (
      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <TouchableOpacity
            key={`setup-keypad-${digit}`}
            style={styles.keyBtn}
            onPress={() => handlePinDigitPress(digit)}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.keyDigit}>{digit}</Text>
            {KEY_SUB_LABELS[digit] ? (
              <Text style={styles.keySubLabel}>{KEY_SUB_LABELS[digit]}</Text>
            ) : null}
          </TouchableOpacity>
        ))}

        {/* Bottom Row: Clear, 0, Backspace */}
        <TouchableOpacity
          style={[styles.keyBtn, styles.keyBtnClear, (!canClear || loading) && styles.keyBtnDisabled]}
          onPress={handlePinClear}
          disabled={!canClear || loading}
          activeOpacity={0.7}
        >
          <Text style={[styles.keyClearText, !canClear && styles.keyTextDisabled]}>CLR</Text>
          <Text style={[styles.keyClearSubText, !canClear && styles.keyTextDisabled]}>Clear</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.keyBtn}
          onPress={() => handlePinDigitPress('0')}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.keyDigit}>0</Text>
          <Text style={styles.keySubLabel}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.keyBtn, styles.keyBtnDelete, (!canDelete || loading) && styles.keyBtnDisabled]}
          onPress={handlePinDelete}
          disabled={!canDelete || loading}
          activeOpacity={0.7}
        >
          <Delete size={20} color={canDelete && !loading ? '#DE8626' : '#CBD5E1'} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.centerContainer}>
          <View style={[styles.card, { width: cardWidth }]}>
            {/* Header Icon */}
            <View style={styles.iconCircle}>
              <KeyRound size={28} color="#DE8626" />
            </View>

            {/* Title & Subtitle */}
            <Text style={styles.title}>Set Up Your POS PIN</Text>
            <Text style={styles.subtitle}>
              Create a personal 4-digit PIN for rapid terminal unlocking and quick staff switching.
            </Text>

            {/* Error Banner */}
            {errorMsg && (
              <View style={styles.errorBanner}>
                <AlertCircle size={15} color="#DC2626" />
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            )}

            {/* Card 1: New PIN */}
            <TouchableOpacity
              style={[
                styles.pinSelectorCard,
                activePinField === 'pin' && styles.pinSelectorCardActive,
              ]}
              onPress={() => setActivePinField('pin')}
              activeOpacity={0.85}
            >
              <View style={styles.pinSelectorHeader}>
                <View style={styles.pinSelectorTitleRow}>
                  <KeyRound size={16} color={activePinField === 'pin' ? '#DE8626' : '#7C6F62'} />
                  <Text
                    style={[
                      styles.pinSelectorLabel,
                      activePinField === 'pin' && styles.pinSelectorLabelActive,
                    ]}
                  >
                    New 4-Digit PIN
                  </Text>
                </View>
                <View style={styles.pinSelectorActionRow}>
                  {pin.length === 4 ? (
                    <View style={styles.pillBadgeSuccess}>
                      <CheckCircle2 size={12} color="#059669" />
                      <Text style={styles.pillBadgeTextSuccess}>Set</Text>
                    </View>
                  ) : activePinField === 'pin' ? (
                    <View style={styles.pillBadgeActive}>
                      <Text style={styles.pillBadgeTextActive}>Entering...</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => setShowPin((v) => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {showPin ? (
                      <EyeOff size={16} color="#7C6F62" />
                    ) : (
                      <Eye size={16} color="#7C6F62" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* 4 Vault Digits / Dots */}
              <View style={styles.vaultRow}>
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = pin.length > idx;
                  const isCurrent = activePinField === 'pin' && pin.length === idx;
                  const digit = pin[idx];
                  return (
                    <View
                      key={`pin-vault-${idx}`}
                      style={[
                        styles.pinVaultBox,
                        isCurrent && styles.pinVaultBoxCurrent,
                        isFilled && styles.pinVaultBoxFilled,
                      ]}
                    >
                      {isFilled ? (
                        showPin ? (
                          <Text style={styles.pinVaultDigitText}>{digit}</Text>
                        ) : (
                          <View style={styles.pinVaultDotFilled} />
                        )
                      ) : isCurrent ? (
                        <View style={styles.pinVaultDotCurrent} />
                      ) : (
                        <View style={styles.pinVaultDotEmpty} />
                      )}
                    </View>
                  );
                })}
              </View>
            </TouchableOpacity>

            {/* Card 2: Confirm PIN */}
            <TouchableOpacity
              style={[
                styles.pinSelectorCard,
                activePinField === 'confirmPin' && styles.pinSelectorCardActive,
              ]}
              onPress={() => setActivePinField('confirmPin')}
              activeOpacity={0.85}
            >
              <View style={styles.pinSelectorHeader}>
                <View style={styles.pinSelectorTitleRow}>
                  <ShieldCheck size={16} color={activePinField === 'confirmPin' ? '#DE8626' : '#7C6F62'} />
                  <Text
                    style={[
                      styles.pinSelectorLabel,
                      activePinField === 'confirmPin' && styles.pinSelectorLabelActive,
                    ]}
                  >
                    Confirm 4-Digit PIN
                  </Text>
                </View>
                <View style={styles.pinSelectorActionRow}>
                  {confirmPin.length === 4 ? (
                    pin === confirmPin ? (
                      <View style={styles.pillBadgeSuccess}>
                        <CheckCircle2 size={12} color="#059669" />
                        <Text style={styles.pillBadgeTextSuccess}>Match</Text>
                      </View>
                    ) : (
                      <View style={styles.pillBadgeMismatch}>
                        <AlertCircle size={12} color="#DC2626" />
                        <Text style={styles.pillBadgeTextMismatch}>Mismatch</Text>
                      </View>
                    )
                  ) : activePinField === 'confirmPin' ? (
                    <View style={styles.pillBadgeActive}>
                      <Text style={styles.pillBadgeTextActive}>Entering...</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => setShowConfirmPin((v) => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {showConfirmPin ? (
                      <EyeOff size={16} color="#7C6F62" />
                    ) : (
                      <Eye size={16} color="#7C6F62" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* 4 Vault Digits / Dots */}
              <View style={styles.vaultRow}>
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = confirmPin.length > idx;
                  const isCurrent = activePinField === 'confirmPin' && confirmPin.length === idx;
                  const digit = confirmPin[idx];
                  const isMismatch =
                    confirmPin.length === 4 && pin.length === 4 && pin !== confirmPin;
                  return (
                    <View
                      key={`confirm-pin-vault-${idx}`}
                      style={[
                        styles.pinVaultBox,
                        isCurrent && styles.pinVaultBoxCurrent,
                        isFilled && styles.pinVaultBoxFilled,
                        isMismatch && styles.pinVaultBoxMismatch,
                      ]}
                    >
                      {isFilled ? (
                        showConfirmPin ? (
                          <Text style={styles.pinVaultDigitText}>{digit}</Text>
                        ) : (
                          <View
                            style={[
                              styles.pinVaultDotFilled,
                              isMismatch && styles.pinVaultDotMismatch,
                            ]}
                          />
                        )
                      ) : isCurrent ? (
                        <View style={styles.pinVaultDotCurrent} />
                      ) : (
                        <View style={styles.pinVaultDotEmpty} />
                      )}
                    </View>
                  );
                })}
              </View>
            </TouchableOpacity>

            {/* PIN Match / Status Notice */}
            {pin.length === 4 && confirmPin.length === 4 && (
              <View
                style={[
                  styles.matchNotice,
                  pin === confirmPin ? styles.matchNoticeSuccess : styles.matchNoticeError,
                ]}
              >
                {pin === confirmPin ? (
                  <>
                    <CheckCircle2 size={14} color="#059669" />
                    <Text style={styles.matchNoticeTextSuccess}>PINs match perfectly! Ready to save.</Text>
                  </>
                ) : (
                  <>
                    <AlertCircle size={14} color="#DC2626" />
                    <Text style={styles.matchNoticeTextError}>PINs do not match. Please re-enter.</Text>
                  </>
                )}
              </View>
            )}

            {/* 3x4 Tactile Keypad */}
            {renderNumericKeypad()}

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (pin.length !== 4 || confirmPin.length !== 4 || pin !== confirmPin || loading) &&
                  styles.primaryBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={pin.length !== 4 || confirmPin.length !== 4 || pin !== confirmPin || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Save & Activate PIN</Text>
                  <ArrowRight size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            {/* Skip Option */}
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={handleSkip}
              activeOpacity={0.7}
            >
              <Text style={styles.skipBtnText}>Skip for now (Use default 1234)</Text>
            </TouchableOpacity>

            {/* Legal Terms & Privacy Notice */}
            <View style={styles.termsFooterLink}>
              <Scale size={13} color="#A8A29E" style={{ marginRight: 5, marginTop: 1 }} />
              <Text style={styles.termsFooterText}>
                By setting up your PIN, you agree to Menza's{' '}
                <Text
                  onPress={() => setTermsModalVisible(true)}
                  style={styles.termsFooterHighlight}
                >
                  Terms & Conditions
                </Text>
                {' '}and{' '}
                <Text
                  onPress={() => setPrivacyModalVisible(true)}
                  style={styles.termsFooterHighlight}
                >
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </View>

          {/* Security Hint */}
          <View style={styles.securityHint}>
            <ShieldCheck size={13} color="#9CA3AF" />
            <Text style={styles.securityHintText}>
              Your PIN is securely hashed & stored per terminal
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Terms and Conditions Modal */}
      <TermsAndConditionsModal
        visible={termsModalVisible}
        onClose={() => setTermsModalVisible(false)}
        onOpenPrivacyPolicy={() => setPrivacyModalVisible(true)}
      />

      {/* Privacy Policy & DPDP Data Protection Modal */}
      <PrivacyPolicyModal
        visible={privacyModalVisible}
        onClose={() => setPrivacyModalVisible(false)}
        onOpenTerms={() => setTermsModalVisible(true)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 48,
  },
  centerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFF0DE',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 21,
    fontWeight: '900',
    color: '#1E2930',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D96B14',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#667085',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    width: '100%',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  pinSelectorCard: {
    width: '100%',
    backgroundColor: '#FAF7F2',
    borderWidth: 1.5,
    borderColor: '#E7E1DA',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  pinSelectorCardActive: {
    borderColor: '#DE8626',
    backgroundColor: '#FFFFFF',
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  pinSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pinSelectorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pinSelectorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#667085',
  },
  pinSelectorLabelActive: {
    color: '#1E2930',
    fontWeight: '800',
  },
  pinSelectorActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillBadgeActive: {
    backgroundColor: '#FFF0DE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  pillBadgeTextActive: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DE8626',
  },
  pillBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pillBadgeTextSuccess: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  pillBadgeMismatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  pillBadgeTextMismatch: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  vaultRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  pinVaultBox: {
    width: 44,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E7E1DA',
    backgroundColor: '#FAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinVaultBoxCurrent: {
    borderColor: '#DE8626',
    backgroundColor: '#FFF8F1',
    borderWidth: 2,
  },
  pinVaultBoxFilled: {
    borderColor: '#DE8626',
    backgroundColor: '#FFFFFF',
  },
  pinVaultBoxMismatch: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  pinVaultDotEmpty: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  pinVaultDotCurrent: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DE8626',
  },
  pinVaultDotFilled: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DE8626',
  },
  pinVaultDotMismatch: {
    backgroundColor: '#DC2626',
  },
  pinVaultDigitText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E2930',
  },
  matchNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 6,
    width: '100%',
  },
  matchNoticeSuccess: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  matchNoticeTextSuccess: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  matchNoticeError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  matchNoticeTextError: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  keypad: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 6,
  },
  keyBtn: {
    width: '31%',
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBtnClear: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  keyBtnDelete: {
    backgroundColor: 'rgba(222, 134, 38, 0.08)',
    borderColor: 'rgba(222, 134, 38, 0.25)',
  },
  keyBtnDisabled: {
    opacity: 0.4,
  },
  keyDigit: {
    fontSize: 19,
    fontWeight: '900',
    color: '#1E2930',
    lineHeight: 22,
  },
  keySubLabel: {
    fontSize: 7.5,
    fontWeight: '800',
    color: '#8C7A6B',
    letterSpacing: 1,
    marginTop: 1,
  },
  keyClearText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#DC2626',
  },
  keyClearSubText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#DC2626',
  },
  keyTextDisabled: {
    color: '#9CA3AF',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 50,
    borderRadius: 16,
    backgroundColor: '#DE8626',
    marginTop: 10,
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  skipBtnText: {
    fontSize: 12,
    color: '#667085',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  securityHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  securityHintText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  termsFooterLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  termsFooterText: {
    fontSize: 11,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 16,
  },
  termsFooterHighlight: {
    color: '#D96B14',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
