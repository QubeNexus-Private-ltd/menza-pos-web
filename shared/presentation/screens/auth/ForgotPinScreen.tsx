import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Delete,
  Eye,
  EyeOff,
  KeyRound,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import { useAuthStore } from '../../state/useAuthStore';
import { useAutoVerifyOtp } from '../../hooks/useAutoVerifyOtp';
import { AuthRemoteDataSource } from '../../../data/datasources/AuthRemoteDataSource';
import { AuthRepositoryImpl } from '../../../data/repositories/AuthRepositoryImpl';
import { getAuthErrorMessage } from '../../../core/utils/errorSanitizer';
import { logger, maskMobile } from '../../../core/logging';
import { TermsAndConditionsModal } from '../legal/TermsAndConditionsModal';
import { PrivacyPolicyModal } from '../legal/PrivacyPolicyModal';

const authRepository = new AuthRepositoryImpl(new AuthRemoteDataSource());

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

interface OtpResendTimerProps {
  onResend: () => Promise<void>;
  loading: boolean;
}

const OtpResendTimer: React.FC<OtpResendTimerProps> = React.memo(({ onResend, loading }) => {
  const [seconds, setSeconds] = useState(120);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    setSeconds(120);
    setCanResend(false);
    const interval = setInterval(() => {
      setSeconds((val) => {
        if (val <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return val - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handlePress = async () => {
    if (loading || !canResend) return;
    setSeconds(120);
    setCanResend(false);
    await onResend();
  };

  const formatTimer = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <View style={styles.resendRow}>
      <Text style={styles.resendPrompt}>Didn't receive code? </Text>
      {canResend ? (
        <TouchableOpacity
          onPress={handlePress}
          disabled={loading}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.resendActiveText}>Resend OTP</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.resendTimerText}>Resend in {formatTimer(seconds)}</Text>
      )}
    </View>
  );
});

export const ForgotPinScreen: React.FC = () => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const rememberedMobile = useAuthStore((state) => state.rememberedMobile);
  const initialMobile = (rememberedMobile || '').replace(/[^0-9]/g, '').slice(-10);

  const [step, setStep] = useState<'mobile' | 'otp' | 'pin'>('mobile');
  const [mobile, setMobile] = useState(initialMobile);
  const [otpCode, setOtpCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [activePinField, setActivePinField] = useState<'newPin' | 'confirmNewPin'>('newPin');
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmNewPin, setShowConfirmNewPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [successStaffName, setSuccessStaffName] = useState('');

  const mobileInputRef = useRef<TextInput>(null);

  const resetPinWithOtp = useAuthStore((state) => state.resetPinWithOtp);
  const setAuthMode = useAuthStore((state) => state.setAuthMode);

  const isSmallWidth = windowWidth < 380;
  const isTablet = Math.min(windowWidth, windowHeight) >= 600;
  const cardWidth = isTablet ? 420 : Math.min(windowWidth - 32, 380);

  const { clipboardOtp, pasteClipboardOtp } = useAutoVerifyOtp({
    enabled: step === 'otp',
    numberOfDigits: 6,
    onOtpReceived: (detectedCode) => {
      setOtpCode(detectedCode);
      Keyboard.dismiss();
      setTimeout(() => {
        setStep('pin');
        setActivePinField('newPin');
      }, 300);
    },
  });

  const handleMobileChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 10);
    setMobile(cleaned);
    if (errorMsg) setErrorMsg(null);
  };

  // OTP Keypad Handlers
  const handleOtpDigitPress = (digit: string) => {
    if (errorMsg) setErrorMsg(null);
    if (otpCode.length < 6) {
      const nextCode = otpCode + digit;
      setOtpCode(nextCode);
      if (nextCode.length === 6) {
        setTimeout(() => {
          setStep('pin');
          setActivePinField('newPin');
        }, 250);
      }
    }
  };

  const handleOtpDelete = () => {
    if (errorMsg) setErrorMsg(null);
    if (otpCode.length > 0) {
      setOtpCode(otpCode.slice(0, -1));
    }
  };

  const handleOtpClear = () => {
    if (errorMsg) setErrorMsg(null);
    setOtpCode('');
  };

  // PIN Keypad Handlers
  const handlePinDigitPress = (digit: string) => {
    if (errorMsg) setErrorMsg(null);
    if (activePinField === 'newPin') {
      if (newPin.length < 4) {
        const nextPin = newPin + digit;
        setNewPin(nextPin);
        if (nextPin.length === 4) {
          setTimeout(() => {
            setActivePinField('confirmNewPin');
          }, 150);
        }
      }
    } else {
      if (confirmNewPin.length < 4) {
        const nextConfirm = confirmNewPin + digit;
        setConfirmNewPin(nextConfirm);
      }
    }
  };

  const handlePinDelete = () => {
    if (errorMsg) setErrorMsg(null);
    if (activePinField === 'confirmNewPin') {
      if (confirmNewPin.length > 0) {
        setConfirmNewPin(confirmNewPin.slice(0, -1));
      } else {
        setActivePinField('newPin');
      }
    } else {
      if (newPin.length > 0) {
        setNewPin(newPin.slice(0, -1));
      }
    }
  };

  const handlePinClear = () => {
    if (errorMsg) setErrorMsg(null);
    if (activePinField === 'confirmNewPin') {
      setConfirmNewPin('');
    } else {
      setNewPin('');
    }
  };

  // Step 1: Send OTP to registered mobile
  const handleSendOtp = async () => {
    if (loading) return;
    if (mobile.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit registered mobile number.');
      return;
    }

    try {
      Keyboard.dismiss();
      setLoading(true);
      setErrorMsg(null);
      logger.auth('OTP_REQUEST_STARTED', 'Sending OTP for PIN recovery', {
        mobile: maskMobile(mobile),
      });
      const res = await authRepository.generateOtp(mobile);

      if (res?.otpCode && /^\d{6}$/.test(res.otpCode)) {
        setOtpCode(res.otpCode);
        setStep('pin');
        setActivePinField('newPin');
      } else {
        setStep('otp');
      }
    } catch (err: any) {
      logger.auth('OTP_REQUEST_FAILED', 'Failed to send OTP for PIN recovery', {
        error: err?.message,
      });
      setErrorMsg(getAuthErrorMessage(err, 'send_otp'));
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (loading) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await authRepository.generateOtp(mobile);
      if (res?.otpCode && /^\d{6}$/.test(res.otpCode)) {
        setOtpCode(res.otpCode);
        setStep('pin');
        setActivePinField('newPin');
      }
    } catch (err: any) {
      setErrorMsg(getAuthErrorMessage(err, 'resend_otp'));
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify OTP and save new PIN
  const handleResetSubmit = async () => {
    if (loading) return;

    if (otpCode.length !== 6) {
      setStep('otp');
      setErrorMsg('Please enter the complete 6-digit OTP code.');
      return;
    }
    if (newPin.length !== 4) {
      setErrorMsg('New PIN must be exactly 4 digits.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setErrorMsg('New PIN and Confirm PIN do not match.');
      return;
    }

    try {
      Keyboard.dismiss();
      setLoading(true);
      setErrorMsg(null);
      logger.auth('OTP_VERIFICATION_STARTED', 'Submitting OTP and new PIN');
      const result = await resetPinWithOtp(mobile, otpCode, newPin);
      if (!result.success) {
        setErrorMsg(result.message || 'Failed to reset PIN. Invalid or expired OTP.');
      } else {
        setResetSuccess(true);
        setSuccessStaffName(result.staffName || 'Staff Member');
        setTimeout(() => {
          setAuthMode('pin');
        }, 1800);
      }
    } catch (err: any) {
      logger.auth('OTP_VERIFICATION_FAILED', 'Failed to reset PIN', { error: err?.message });
      setErrorMsg(err?.message || 'Failed to reset PIN.');
    } finally {
      setLoading(false);
    }
  };

  // Reusable 3x4 Tactile Numeric Keypad
  const renderNumericKeypad = (
    onDigit: (d: string) => void,
    onDelete: () => void,
    onClear: () => void,
    canClear: boolean,
    canDelete: boolean
  ) => (
    <View style={styles.keypad}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
        <TouchableOpacity
          key={`keypad-${digit}`}
          style={styles.keyBtn}
          onPress={() => onDigit(digit)}
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
        onPress={onClear}
        disabled={!canClear || loading}
        activeOpacity={0.7}
      >
        <Text style={[styles.keyClearText, !canClear && styles.keyTextDisabled]}>CLR</Text>
        <Text style={[styles.keyClearSubText, !canClear && styles.keyTextDisabled]}>Clear</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.keyBtn}
        onPress={() => onDigit('0')}
        disabled={loading}
        activeOpacity={0.7}
      >
        <Text style={styles.keyDigit}>0</Text>
        <Text style={styles.keySubLabel}>+</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.keyBtn, styles.keyBtnDelete, (!canDelete || loading) && styles.keyBtnDisabled]}
        onPress={onDelete}
        disabled={!canDelete || loading}
        activeOpacity={0.7}
      >
        <Delete size={20} color={canDelete && !loading ? '#DE8626' : '#CBD5E1'} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        style={styles.flexOne}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.centerContainer}>
            <View style={[styles.card, { width: cardWidth }]}>
              {/* Back button */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  Keyboard.dismiss();
                  if (step === 'pin') {
                    setStep('otp');
                  } else if (step === 'otp') {
                    setStep('mobile');
                    setOtpCode('');
                    setErrorMsg(null);
                  } else {
                    setAuthMode('pin');
                  }
                }}
                activeOpacity={0.7}
              >
                <ArrowLeft size={16} color="#7C6F62" />
                <Text style={styles.backButtonText}>
                  {step === 'pin'
                    ? 'Back to OTP code'
                    : step === 'otp'
                    ? 'Change mobile number'
                    : 'Back to PIN'}
                </Text>
              </TouchableOpacity>

              {/* Header Icon */}
              <View style={styles.iconCircle}>
                {step === 'pin' ? (
                  <KeyRound size={26} color="#DE8626" />
                ) : (
                  <RotateCcw size={26} color="#DE8626" />
                )}
              </View>

              {/* Title & Subtitle */}
              <Text style={styles.title}>
                {step === 'mobile'
                  ? 'Forgot Staff PIN'
                  : step === 'otp'
                  ? 'Enter Verification Code'
                  : 'Set New Staff PIN'}
              </Text>
              <Text style={styles.subtitle}>
                {step === 'mobile'
                  ? 'Enter your registered mobile number to receive a 6-digit verification code'
                  : step === 'otp'
                  ? `Enter the 6-digit code sent to +91 ${mobile}`
                  : 'Create a new 4-digit PIN to secure and unlock this POS terminal'}
              </Text>

              {/* Error Banner */}
              {errorMsg && (
                <View style={styles.errorBanner}>
                  <AlertCircle size={15} color="#DC2626" />
                  <Text style={styles.errorBannerText}>{errorMsg}</Text>
                </View>
              )}

              {resetSuccess ? (
                <View style={styles.successContainer}>
                  <View style={styles.successIconCircle}>
                    <CheckCircle2 size={36} color="#10B981" />
                  </View>
                  <Text style={styles.successTitle}>PIN Reset Successfully!</Text>
                  <Text style={styles.successSubtitle}>
                    New 4-digit PIN is active for {successStaffName}. Returning to PIN lock screen...
                  </Text>
                  <ActivityIndicator size="small" color="#DE8626" style={{ marginTop: 16 }} />
                </View>
              ) : step === 'mobile' ? (
                /* Stage 1: Mobile Entry */
                <View style={styles.fullWidth}>
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Registered Mobile Number</Text>
                    <View
                      style={[
                        styles.inputWrapperRow,
                        focusedInput === 'mobile' && styles.inputWrapperFocused,
                      ]}
                    >
                      <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                      <View style={styles.inputDivider} />
                      <TextInput
                        ref={mobileInputRef}
                        style={styles.mobileInput}
                        value={mobile}
                        onChangeText={handleMobileChange}
                        onFocus={() => setFocusedInput('mobile')}
                        onBlur={() => setFocusedInput((prev) => (prev === 'mobile' ? null : prev))}
                        placeholder="10-digit mobile"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        maxLength={10}
                        cursorColor="#DE8626"
                        selectionColor="rgba(222, 134, 38, 0.25)"
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      (mobile.length !== 10 || loading) && styles.primaryBtnDisabled,
                    ]}
                    onPress={handleSendOtp}
                    disabled={mobile.length !== 10 || loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.primaryBtnText}>Send Verification Code</Text>
                        <ArrowRight size={18} color="#FFFFFF" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : step === 'otp' ? (
                /* Stage 2: OTP Entry */
                <View style={styles.fullWidth}>
                  {/* One-Tap Clipboard Paste Chip if 6-digit OTP detected on clipboard */}
                  {clipboardOtp && otpCode.length < 6 ? (
                    <TouchableOpacity
                      style={styles.clipboardChip}
                      onPress={pasteClipboardOtp}
                      activeOpacity={0.8}
                    >
                      <Copy size={13} color="#D96B14" />
                      <Text style={styles.clipboardChipText}>
                        Paste code from SMS: <Text style={styles.clipboardChipBold}>{clipboardOtp}</Text>
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* 6 Discrete OTP Display Boxes */}
                  <View style={styles.otpBoxesRow}>
                    {[0, 1, 2, 3, 4, 5].map((idx) => {
                      const digit = otpCode[idx];
                      const isFilled = digit !== undefined;
                      const isCurrent = otpCode.length === idx;
                      return (
                        <View
                          key={`otp-box-${idx}`}
                          style={[
                            styles.otpBox,
                            isCurrent && styles.otpBoxCurrent,
                            isFilled && styles.otpBoxFilled,
                            Boolean(errorMsg) && styles.otpBoxError,
                          ]}
                        >
                          <Text
                            style={[
                              styles.otpDigitText,
                              isFilled && styles.otpDigitTextFilled,
                              isCurrent && styles.otpCursorText,
                            ]}
                          >
                            {isFilled ? digit : isCurrent ? '|' : '·'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Resend Link */}
                  <OtpResendTimer onResend={handleResendOtp} loading={loading} />

                  {/* 3x4 Tactile Keypad */}
                  {renderNumericKeypad(
                    handleOtpDigitPress,
                    handleOtpDelete,
                    handleOtpClear,
                    otpCode.length > 0,
                    otpCode.length > 0
                  )}

                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      (otpCode.length !== 6 || loading) && styles.primaryBtnDisabled,
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setStep('pin');
                      setActivePinField('newPin');
                    }}
                    disabled={otpCode.length !== 6 || loading}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryBtnText}>Continue to Set PIN</Text>
                    <ArrowRight size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                /* Stage 3: PIN Setup */
                <View style={styles.fullWidth}>
                  {/* Card 1: New PIN */}
                  <TouchableOpacity
                    style={[
                      styles.pinSelectorCard,
                      activePinField === 'newPin' && styles.pinSelectorCardActive,
                    ]}
                    onPress={() => setActivePinField('newPin')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.pinSelectorHeader}>
                      <View style={styles.pinSelectorTitleRow}>
                        <KeyRound size={16} color={activePinField === 'newPin' ? '#DE8626' : '#7C6F62'} />
                        <Text
                          style={[
                            styles.pinSelectorLabel,
                            activePinField === 'newPin' && styles.pinSelectorLabelActive,
                          ]}
                        >
                          New 4-Digit PIN
                        </Text>
                      </View>
                      <View style={styles.pinSelectorActionRow}>
                        {newPin.length === 4 ? (
                          <View style={styles.pillBadgeSuccess}>
                            <CheckCircle2 size={12} color="#10B981" />
                            <Text style={styles.pillBadgeTextSuccess}>Set</Text>
                          </View>
                        ) : activePinField === 'newPin' ? (
                          <View style={styles.pillBadgeActive}>
                            <Text style={styles.pillBadgeTextActive}>Entering...</Text>
                          </View>
                        ) : null}
                        <TouchableOpacity
                          onPress={() => setShowNewPin((v) => !v)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {showNewPin ? (
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
                        const isFilled = newPin.length > idx;
                        const isCurrent = activePinField === 'newPin' && newPin.length === idx;
                        const digit = newPin[idx];
                        return (
                          <View
                            key={`new-pin-vault-${idx}`}
                            style={[
                              styles.pinVaultBox,
                              isCurrent && styles.pinVaultBoxCurrent,
                              isFilled && styles.pinVaultBoxFilled,
                            ]}
                          >
                            {isFilled ? (
                              showNewPin ? (
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

                  {/* Card 2: Confirm New PIN */}
                  <TouchableOpacity
                    style={[
                      styles.pinSelectorCard,
                      activePinField === 'confirmNewPin' && styles.pinSelectorCardActive,
                    ]}
                    onPress={() => setActivePinField('confirmNewPin')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.pinSelectorHeader}>
                      <View style={styles.pinSelectorTitleRow}>
                        <ShieldCheck size={16} color={activePinField === 'confirmNewPin' ? '#DE8626' : '#7C6F62'} />
                        <Text
                          style={[
                            styles.pinSelectorLabel,
                            activePinField === 'confirmNewPin' && styles.pinSelectorLabelActive,
                          ]}
                        >
                          Confirm New PIN
                        </Text>
                      </View>
                      <View style={styles.pinSelectorActionRow}>
                        {confirmNewPin.length === 4 ? (
                          newPin === confirmNewPin ? (
                            <View style={styles.pillBadgeSuccess}>
                              <CheckCircle2 size={12} color="#10B981" />
                              <Text style={styles.pillBadgeTextSuccess}>Match</Text>
                            </View>
                          ) : (
                            <View style={styles.pillBadgeMismatch}>
                              <AlertCircle size={12} color="#DC2626" />
                              <Text style={styles.pillBadgeTextMismatch}>Mismatch</Text>
                            </View>
                          )
                        ) : activePinField === 'confirmNewPin' ? (
                          <View style={styles.pillBadgeActive}>
                            <Text style={styles.pillBadgeTextActive}>Entering...</Text>
                          </View>
                        ) : null}
                        <TouchableOpacity
                          onPress={() => setShowConfirmNewPin((v) => !v)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {showConfirmNewPin ? (
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
                        const isFilled = confirmNewPin.length > idx;
                        const isCurrent = activePinField === 'confirmNewPin' && confirmNewPin.length === idx;
                        const digit = confirmNewPin[idx];
                        const isMismatch =
                          confirmNewPin.length === 4 && newPin.length === 4 && newPin !== confirmNewPin;
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
                              showConfirmNewPin ? (
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
                  {newPin.length === 4 && confirmNewPin.length === 4 && (
                    <View
                      style={[
                        styles.matchNotice,
                        newPin === confirmNewPin ? styles.matchNoticeSuccess : styles.matchNoticeError,
                      ]}
                    >
                      {newPin === confirmNewPin ? (
                        <>
                          <CheckCircle2 size={14} color="#059669" />
                          <Text style={styles.matchNoticeTextSuccess}>PINs match perfectly! Ready to reset.</Text>
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
                  {renderNumericKeypad(
                    handlePinDigitPress,
                    handlePinDelete,
                    handlePinClear,
                    activePinField === 'newPin' ? newPin.length > 0 : confirmNewPin.length > 0,
                    activePinField === 'newPin' ? newPin.length > 0 : confirmNewPin.length > 0
                  )}

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      (newPin.length !== 4 ||
                        confirmNewPin.length !== 4 ||
                        newPin !== confirmNewPin ||
                        loading) &&
                        styles.primaryBtnDisabled,
                    ]}
                    onPress={handleResetSubmit}
                    disabled={
                      newPin.length !== 4 ||
                      confirmNewPin.length !== 4 ||
                      newPin !== confirmNewPin ||
                      loading
                    }
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.primaryBtnText}>Reset PIN & Unlock POS</Text>
                        <ArrowRight size={18} color="#FFFFFF" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Master PIN Reminder */}
            <View style={styles.hintContainer}>
              <Text style={styles.hintText}>
                Default Master PIN: <Text style={styles.hintBold}>1234</Text>
              </Text>
            </View>

            {/* Legal Terms & Privacy Notice */}
            <View style={styles.termsFooterLink}>
              <Scale size={13} color="#A8A29E" style={{ marginRight: 5, marginTop: 1 }} />
              <Text style={styles.termsFooterText}>
                By resetting your PIN, you agree to Menza's{' '}
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
        </ScrollView>
      </KeyboardAvoidingView>

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
  flexOne: {
    flex: 1,
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
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  fullWidth: {
    width: '100%',
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    marginBottom: 14,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D96B14',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF0DE',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 21,
    fontWeight: '900',
    color: '#1E2930',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#667085',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
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
    marginBottom: 16,
    width: '100%',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  formGroup: {
    width: '100%',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  inputWrapperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 52,
    backgroundColor: '#FAF7F2',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  inputDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 10,
  },
  mobileInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '600',
    color: '#1E2930',
    letterSpacing: 1,
  },
  inputWrapperFocused: {
    borderColor: '#DE8626',
    backgroundColor: '#FFFFFF',
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  textInputRow: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '600',
    color: '#1E2930',
    letterSpacing: 2,
    paddingHorizontal: 4,
  },
  clipboardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  clipboardChipText: {
    fontSize: 12,
    color: '#D96B14',
    fontWeight: '600',
  },
  clipboardChipBold: {
    fontWeight: '800',
    color: '#9A3412',
  },
  otpBoxesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginVertical: 12,
  },
  otpBox: {
    width: 42,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E7E1DA',
    backgroundColor: '#FAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxCurrent: {
    borderColor: '#DE8626',
    backgroundColor: '#FFF8F1',
    borderWidth: 2,
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  otpBoxFilled: {
    borderColor: '#DE8626',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.8,
  },
  otpBoxError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  otpDigitText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#CBD5E1',
  },
  otpDigitTextFilled: {
    color: '#1E2930',
  },
  otpCursorText: {
    fontSize: 22,
    fontWeight: '300',
    color: '#DE8626',
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
    marginBottom: 8,
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
    marginTop: 10,
    marginBottom: 8,
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
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  resendPrompt: {
    fontSize: 11,
    color: '#6B7280',
  },
  resendActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D96B14',
  },
  resendTimerText: {
    fontSize: 11,
    fontWeight: '600',
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
    marginTop: 8,
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
  hintContainer: {
    marginTop: 16,
  },
  hintText: {
    fontSize: 11.5,
    color: '#7C6F62',
    fontWeight: '500',
  },
  hintBold: {
    fontWeight: '800',
    color: '#D96B14',
  },
  successContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 18,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#065F46',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  termsFooterLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
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