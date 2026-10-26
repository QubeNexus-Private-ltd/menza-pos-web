import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Lock,
  Delete,
  Store,
  Clock,
  Phone,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Smartphone,
  AlertCircle,
  Check,
  ChevronDown,
  User,
  X,
} from 'lucide-react-native';
import { useAuthStore } from '../../state/useAuthStore';

interface RecentStaff {
  mobile: string;
  name?: string;
  role?: string;
  lastActive: number;
}

const RECENT_STAFF_KEY = '@menza_pos_recent_staff';

const getStoredRecentStaff = async (): Promise<RecentStaff[]> => {
  try {
    const raw = await AsyncStorage.getItem(RECENT_STAFF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const storeRecentStaff = async (staff: { mobile: string; name?: string; role?: string }) => {
  try {
    const cleanMobile = staff.mobile.replace(/[^0-9]/g, '').slice(-10);
    if (cleanMobile.length !== 10) return;
    const current = (await getStoredRecentStaff()).filter((s) => s.mobile !== cleanMobile);
    const updated: RecentStaff[] = [
      {
        mobile: cleanMobile,
        name: staff.name,
        role: staff.role,
        lastActive: Date.now(),
      },
      ...current,
    ].slice(0, 4);
    await AsyncStorage.setItem(RECENT_STAFF_KEY, JSON.stringify(updated));
  } catch {}
};

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

export const PinLockScreen: React.FC = () => {
  const activeRestaurant = useAuthStore((state) => state.activeRestaurant);
  const activeStaffName = useAuthStore((state) => state.activeStaffName);
  const user = useAuthStore((state) => state.user);
  const rememberedMobile = useAuthStore((state) => state.rememberedMobile);
  const unlockWithPin = useAuthStore((state) => state.unlockWithPin);
  const setAuthMode = useAuthStore((state) => state.setAuthMode);

  // Resolved initial phone
  const initialPhone = (rememberedMobile || user?.mobile || '').replace(/[^0-9]/g, '').slice(-10);

  const [step, setStep] = useState<'mobile' | 'pin'>(
    initialPhone.length === 10 ? 'pin' : 'mobile'
  );
  const [mobile, setMobile] = useState<string>(initialPhone);
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [recentStaff, setRecentStaff] = useState<RecentStaff[]>([]);

  // Shake animation for incorrect PIN
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const hasInitializedRef = useRef(Boolean(initialPhone.length === 10));

  // Load recent staff from terminal cache
  useEffect(() => {
    getStoredRecentStaff().then((list) => {
      setRecentStaff(list);
    });
  }, []);

  // Sync remembered mobile if updated externally (e.g. late session hydration) without overriding user clearing input
  useEffect(() => {
    if (!hasInitializedRef.current && rememberedMobile) {
      const clean = rememberedMobile.replace(/[^0-9]/g, '').slice(-10);
      if (clean.length === 10) {
        setMobile(clean);
        setStep('pin');
        hasInitializedRef.current = true;
      }
    }
  }, [rememberedMobile]);

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  // --- STEP 1: MOBILE ENTRY HANDLERS ---
  const handleMobileTextChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 10);
    setMobile(cleaned);
    if (errorMsg) setErrorMsg(null);

    // Auto-advance to PIN pad when 10 digits are reached
    if (cleaned.length === 10) {
      setTimeout(() => {
        setErrorMsg(null);
        setPin('');
        setStep('pin');
      }, 160);
    }
  };

  const handleContinueToPin = () => {
    const clean = mobile.replace(/[^0-9]/g, '').slice(-10);
    if (clean.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    setErrorMsg(null);
    setPin('');
    setStep('pin');
  };

  const handleSelectRecentStaff = (staff: RecentStaff) => {
    setMobile(staff.mobile);
    setPin('');
    setErrorMsg(null);
    setStep('pin');
  };

  const handleBackToMobile = () => {
    setPin('');
    setErrorMsg(null);
    setStep('mobile');
  };

  // --- STEP 2: PIN VERIFICATION HANDLERS ---
  const handleVerifyPin = useCallback(
    async (pinToVerify: string) => {
      if (isVerifying || pinToVerify.length !== 4) return;
      const cleanMobile = mobile.replace(/[^0-9]/g, '').slice(-10);

      setIsVerifying(true);
      setErrorMsg(null);

      try {
        const result = await unlockWithPin(pinToVerify, cleanMobile);
        if (result.success) {
          await storeRecentStaff({
            mobile: cleanMobile,
            name: activeStaffName || user?.name || 'Staff',
            role: user?.roles?.[0] || 'Staff',
          });
        } else {
          triggerShake();
          setErrorMsg(result.message || 'Incorrect PIN. Try again (Default: 1234)');
          setPin('');
        }
      } catch (err: any) {
        triggerShake();
        setErrorMsg('Authentication failed. Please check connection and try again.');
        setPin('');
      } finally {
        setIsVerifying(false);
      }
    },
    [isVerifying, mobile, unlockWithPin, activeStaffName, user]
  );

  const handleKeyPress = useCallback(
    (digit: string) => {
      if (isVerifying) return;

      if (step === 'pin') {
        if (pin.length >= 4) return;
        const nextPin = pin + digit;
        setPin(nextPin);
        if (errorMsg) setErrorMsg(null);

        if (nextPin.length === 4) {
          setTimeout(() => {
            handleVerifyPin(nextPin);
          }, 80);
        }
      } else {
        if (mobile.length >= 10) return;
        const nextMobile = mobile + digit;
        setMobile(nextMobile);
        if (errorMsg) setErrorMsg(null);

        if (nextMobile.length === 10) {
          setTimeout(() => {
            setErrorMsg(null);
            setPin('');
            setStep('pin');
          }, 160);
        }
      }
    },
    [step, pin, mobile, isVerifying, errorMsg, handleVerifyPin]
  );

  const handleDelete = useCallback(() => {
    if (isVerifying) return;
    if (step === 'pin') {
      if (pin.length > 0) {
        setPin((prev) => prev.slice(0, -1));
        if (errorMsg) setErrorMsg(null);
      }
    } else {
      if (mobile.length > 0) {
        setMobile((prev) => prev.slice(0, -1));
        if (errorMsg) setErrorMsg(null);
      }
    }
  }, [step, isVerifying, pin.length, mobile.length, errorMsg]);

  const handleClear = useCallback(() => {
    if (isVerifying) return;
    if (step === 'pin') {
      setPin('');
    } else {
      setMobile('');
    }
    if (errorMsg) setErrorMsg(null);
  }, [step, isVerifying, errorMsg]);

  const restName = activeRestaurant?.restaurantName || 'Menza POS';
  const restSubtitle = activeRestaurant?.city || activeRestaurant?.address || 'Terminal Active';
  const operatorLabel = activeStaffName || user?.name || null;
  const operatorInitial = operatorLabel ? operatorLabel.charAt(0).toUpperCase() : 'S';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      {/* Top Bar: Store Badge & Live Clock */}
      <View style={styles.header}>
        <View style={styles.storeBadge}>
          <Store size={14} color="#DE8626" />
          <View style={styles.storeTextWrap}>
            <Text style={styles.storeName} numberOfLines={1}>
              {restName}
            </Text>
            <Text style={styles.storeSubtitle} numberOfLines={1}>
              {restSubtitle}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.clockBadge}>
            <Clock size={13} color="#DE8626" />
            <Text style={styles.clockText}>{currentTime}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowHelpModal(true)}
            style={styles.helpBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <HelpCircle size={18} color="#8C7A6B" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Main Card Shell */}
        <View style={styles.card}>
          {/* Lock Icon */}
          <View style={styles.lockIconCircle}>
            <Lock size={24} color="#DE8626" />
          </View>

          {/* Segmented Auth Mode Switcher */}
          <View style={styles.modeSwitcher}>
            <View style={[styles.modeTab, styles.modeTabActive]}>
              <Lock size={12} color="#DE8626" />
              <Text style={styles.modeTabTextActive}>Quick Staff PIN</Text>
            </View>
            <TouchableOpacity
              style={styles.modeTab}
              onPress={() => setAuthMode('otp')}
              activeOpacity={0.7}
            >
              <Smartphone size={12} color="#8C7A6B" />
              <Text style={styles.modeTabText}>Mobile OTP</Text>
            </TouchableOpacity>
          </View>

          {/* ======================================================== */}
          {/* STEP 1: OPERATOR MOBILE NUMBER IDENTIFICATION            */}
          {/* ======================================================== */}
          {step === 'mobile' ? (
            <View style={styles.stepContainer}>
              <View style={styles.titleSection}>
                <Text style={styles.title}>Operator Identification</Text>
                <Text style={styles.subtitle}>
                  Select recent staff or enter 10-digit mobile number
                </Text>
              </View>

              {/* Quick Staff Switch Chips */}
              {recentStaff.length > 0 && (
                <View style={styles.recentSection}>
                  <View style={styles.recentHeader}>
                    <Text style={styles.recentLabel}>RECENT OPERATORS</Text>
                    <Text style={styles.recentActionText}>1-Tap Switch</Text>
                  </View>
                  <View style={styles.recentGrid}>
                    {recentStaff.map((staff) => (
                      <TouchableOpacity
                        key={staff.mobile}
                        onPress={() => handleSelectRecentStaff(staff)}
                        style={styles.recentCard}
                        activeOpacity={0.7}
                      >
                        <View style={styles.recentAvatar}>
                          <Text style={styles.recentAvatarText}>
                            {staff.name ? staff.name.charAt(0).toUpperCase() : 'S'}
                          </Text>
                        </View>
                        <View style={styles.recentInfo}>
                          <Text style={styles.recentName} numberOfLines={1}>
                            {staff.name || 'Staff'}
                          </Text>
                          <Text style={styles.recentPhone}>
                            •••• {staff.mobile.slice(-4)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {errorMsg && (
                <View style={styles.errorBanner}>
                  <AlertCircle size={15} color="#DC2626" />
                  <Text style={styles.errorBannerText}>{errorMsg}</Text>
                </View>
              )}

              {/* Mobile Input Field */}
              <View style={styles.mobileInputBox}>
                <View style={styles.flagPrefix}>
                  <Text style={styles.flagEmoji}>🇮🇳</Text>
                  <Text style={styles.prefixText}>+91</Text>
                </View>
                <TextInput
                  style={styles.mobileInput}
                  value={mobile}
                  onChangeText={handleMobileTextChange}
                  placeholder="Enter 10-digit mobile"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  maxLength={10}
                />
                {mobile.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setMobile('')}
                    style={styles.clearInputBtn}
                  >
                    <Text style={styles.clearInputText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                onPress={handleContinueToPin}
                disabled={mobile.length !== 10}
                style={[
                  styles.continueBtn,
                  mobile.length !== 10 && styles.continueBtnDisabled,
                ]}
                activeOpacity={0.8}
              >
                <Text style={styles.continueBtnText}>Continue to PIN</Text>
                <ArrowRight size={16} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Touchpad Numeric Dialpad */}
              <View style={styles.keypad}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <TouchableOpacity
                    key={`dial-${digit}`}
                    style={styles.keyBtn}
                    onPress={() => handleKeyPress(digit)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.keyDigit}>{digit}</Text>
                    {KEY_SUB_LABELS[digit] ? (
                      <Text style={styles.keySubLabel}>{KEY_SUB_LABELS[digit]}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.keyBtn, styles.keyBtnSpecial]}
                  onPress={handleClear}
                  disabled={mobile.length === 0}
                  activeOpacity={0.7}
                >
                  <Text style={styles.keySpecialText}>CLR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.keyBtn}
                  onPress={() => handleKeyPress('0')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.keyDigit}>0</Text>
                  <Text style={styles.keySubLabel}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.keyBtn, styles.keyBtnSpecial]}
                  onPress={handleDelete}
                  disabled={mobile.length === 0}
                  activeOpacity={0.7}
                >
                  <Delete size={20} color="#8C7A6B" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ======================================================== */
            /* STEP 2: HIGH-VISIBILITY PIN KEYPAD                       */
            /* ======================================================== */
            <View style={styles.stepContainer}>
              {/* Recognized Operator Banner */}
              <View style={styles.operatorBanner}>
                <View style={styles.operatorLeft}>
                  <View style={styles.operatorAvatar}>
                    <Text style={styles.operatorAvatarText}>{operatorInitial}</Text>
                  </View>
                  <View style={styles.operatorMeta}>
                    <View style={styles.operatorNameRow}>
                      <Text style={styles.operatorName} numberOfLines={1}>
                        {operatorLabel || 'Staff Operator'}
                      </Text>
                      <View style={styles.activeTag}>
                        <Text style={styles.activeTagText}>Active</Text>
                      </View>
                    </View>
                    <Text style={styles.operatorPhone}>
                      +91 {mobile.slice(0, 5)} {mobile.slice(5)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={handleBackToMobile}
                  style={styles.switchStaffBtn}
                  activeOpacity={0.7}
                >
                  <RefreshCw size={12} color="#DE8626" />
                  <Text style={styles.switchStaffText}>Switch</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.pinTitle}>Enter 4-Digit Staff PIN</Text>

              {/* 4 Digit Indicators */}
              <Animated.View
                style={[
                  styles.vaultRow,
                  { transform: [{ translateX: shakeAnim }] },
                ]}
              >
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = pin.length > idx;
                  const isCurrent = pin.length === idx;
                  return (
                    <View
                      key={`pin-vault-${idx}`}
                      style={[
                        styles.vaultBox,
                        isFilled && styles.vaultBoxFilled,
                        isCurrent && styles.vaultBoxCurrent,
                      ]}
                    >
                      {isFilled ? (
                        <View style={styles.vaultDotFilled} />
                      ) : (
                        <View
                          style={[
                            styles.vaultDotEmpty,
                            isCurrent && styles.vaultDotCurrent,
                          ]}
                        />
                      )}
                    </View>
                  );
                })}
              </Animated.View>

              {/* Status or Hint Message */}
              <View style={styles.messageRow}>
                {isVerifying ? (
                  <View style={styles.verifyingRow}>
                    <ActivityIndicator size="small" color="#DE8626" />
                    <Text style={styles.verifyingText}>Authenticating credentials...</Text>
                  </View>
                ) : errorMsg ? (
                  <View style={styles.errorRow}>
                    <AlertCircle size={14} color="#DC2626" />
                    <Text style={styles.errorMsgText}>{errorMsg}</Text>
                  </View>
                ) : (
                  <Text style={styles.hintText}>
                    Enter 4-digit PIN • Default: <Text style={styles.hintBold}>1234</Text>
                  </Text>
                )}
              </View>

              {/* 3x4 Tactile Numeric Keypad */}
              <View style={styles.keypad}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <TouchableOpacity
                    key={`pin-digit-${digit}`}
                    style={styles.keyBtn}
                    onPress={() => handleKeyPress(digit)}
                    disabled={isVerifying}
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
                  style={[styles.keyBtn, styles.keyBtnClear]}
                  onPress={handleClear}
                  disabled={isVerifying || pin.length === 0}
                  activeOpacity={0.7}
                >
                  <Text style={styles.keyClearText}>CLR</Text>
                  <Text style={styles.keyClearSubText}>Reset</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.keyBtn}
                  onPress={() => handleKeyPress('0')}
                  disabled={isVerifying}
                  activeOpacity={0.7}
                >
                  <Text style={styles.keyDigit}>0</Text>
                  <Text style={styles.keySubLabel}>+</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.keyBtn, styles.keyBtnDelete]}
                  onPress={handleDelete}
                  disabled={isVerifying || pin.length === 0}
                  activeOpacity={0.7}
                >
                  <Delete size={20} color="#DE8626" />
                </TouchableOpacity>
              </View>

              {/* Footer Links: Forgot PIN & OTP Switch */}
              <View style={styles.footerLinks}>
                <TouchableOpacity
                  onPress={() => setAuthMode('forgot_pin')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotPinText}>Forgot Staff PIN?</Text>
                </TouchableOpacity>
                <Text style={styles.linkDivider}>•</Text>
                <TouchableOpacity
                  onPress={() => setAuthMode('otp')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.otpLinkText}>Login with OTP</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Help Modal */}
      <Modal
        visible={showHelpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleWrap}>
                <HelpCircle size={18} color="#DE8626" />
                <Text style={styles.modalTitle}>PIN Authentication Help</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowHelpModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color="#667085" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalItemTitle}>• Default Staff PIN:</Text>
              <Text style={styles.modalItemBody}>
                If you have not set a custom PIN yet, the default master PIN is <Text style={{ fontWeight: '800', color: '#DE8626' }}>1234</Text>.
              </Text>

              <Text style={styles.modalItemTitle}>• Switching Operators:</Text>
              <Text style={styles.modalItemBody}>
                Tap the "Switch" button to enter another staff member's mobile number or tap their avatar card.
              </Text>

              <Text style={styles.modalItemTitle}>• Reset or Forgot PIN:</Text>
              <Text style={styles.modalItemBody}>
                Tap "Forgot Staff PIN?" or "Mobile OTP" to verify your registered mobile number with an OTP and set a new PIN.
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowHelpModal(false)}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E1DA',
    backgroundColor: '#FFFFFF',
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  storeTextWrap: {
    flex: 1,
  },
  storeName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E2930',
  },
  storeSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8C7A6B',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  clockText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E2930',
    fontVariant: ['tabular-nums'],
  },
  helpBtn: {
    padding: 4,
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    padding: 20,
    alignItems: 'center',
    shadowColor: '#1E2930',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  lockIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(222, 134, 38, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#FAF7F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    padding: 3,
    marginBottom: 16,
    width: '100%',
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 11,
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  modeTabTextActive: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DE8626',
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8C7A6B',
  },
  stepContainer: {
    width: '100%',
    alignItems: 'center',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1E2930',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#667085',
    marginTop: 2,
    textAlign: 'center',
  },
  recentSection: {
    width: '100%',
    marginBottom: 12,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  recentLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8C7A6B',
    letterSpacing: 0.8,
  },
  recentActionText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DE8626',
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentCard: {
    flex: 1,
    minWidth: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRadius: 14,
    padding: 8,
  },
  recentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#DE8626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E2930',
  },
  recentPhone: {
    fontSize: 9,
    fontWeight: '600',
    color: '#8C7A6B',
  },
  errorBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 8,
    marginBottom: 10,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  mobileInputBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    borderWidth: 2,
    borderColor: '#E7E1DA',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 10,
  },
  flagPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: '#E7E1DA',
  },
  flagEmoji: {
    fontSize: 14,
  },
  prefixText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E2930',
  },
  mobileInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#1E2930',
    paddingHorizontal: 8,
    paddingVertical: 6,
    letterSpacing: 1,
  },
  clearInputBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  clearInputText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  continueBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DE8626',
    borderRadius: 16,
    paddingVertical: 12,
    marginBottom: 14,
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  continueBtnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  continueBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  operatorBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(222, 134, 38, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(222, 134, 38, 0.25)',
    borderRadius: 16,
    padding: 10,
    marginBottom: 12,
  },
  operatorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  operatorAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#DE8626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorAvatarText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  operatorMeta: {
    flex: 1,
  },
  operatorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  operatorName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E2930',
  },
  activeTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  activeTagText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#10B981',
    textTransform: 'uppercase',
  },
  operatorPhone: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8C7A6B',
    marginTop: 1,
  },
  switchStaffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  switchStaffText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DE8626',
  },
  pinTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E2930',
    marginBottom: 10,
  },
  vaultRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  vaultBox: {
    width: 48,
    height: 54,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E7E1DA',
    backgroundColor: '#FAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultBoxCurrent: {
    borderColor: '#DE8626',
    backgroundColor: '#FFFFFF',
  },
  vaultBoxFilled: {
    borderColor: '#DE8626',
    backgroundColor: '#DE8626',
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  vaultDotEmpty: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E7E1DA',
  },
  vaultDotCurrent: {
    backgroundColor: '#DE8626',
  },
  vaultDotFilled: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  messageRow: {
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifyingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DE8626',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  errorMsgText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  hintText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8C7A6B',
  },
  hintBold: {
    fontWeight: '900',
    color: '#DE8626',
  },
  keypad: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  keyBtn: {
    width: '31%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBtnSpecial: {
    backgroundColor: '#F3EFEA',
  },
  keyBtnClear: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  keyBtnDelete: {
    backgroundColor: 'rgba(222, 134, 38, 0.08)',
    borderColor: 'rgba(222, 134, 38, 0.25)',
  },
  keyDigit: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E2930',
    lineHeight: 24,
  },
  keySubLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#8C7A6B',
    letterSpacing: 1,
  },
  keySpecialText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  keyClearText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#DC2626',
  },
  keyClearSubText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#DC2626',
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  forgotPinText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8C7A6B',
  },
  linkDivider: {
    fontSize: 10,
    color: '#CBD5E1',
  },
  otpLinkText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DE8626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1E2930',
  },
  modalContent: {
    gap: 8,
    marginBottom: 16,
  },
  modalItemTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E2930',
  },
  modalItemBody: {
    fontSize: 11,
    fontWeight: '500',
    color: '#667085',
    lineHeight: 16,
    marginBottom: 4,
  },
  modalCloseBtn: {
    width: '100%',
    backgroundColor: '#DE8626',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
