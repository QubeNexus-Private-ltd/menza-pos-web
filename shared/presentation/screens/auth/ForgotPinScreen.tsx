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
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import { useAuthStore } from '../../state/useAuthStore';
import { AuthRemoteDataSource } from '../../../data/datasources/AuthRemoteDataSource';
import { AuthRepositoryImpl } from '../../../data/repositories/AuthRepositoryImpl';
import { getAuthErrorMessage } from '../../../core/utils/errorSanitizer';
import { logger, maskMobile } from '../../../core/logging';

const authRepository = new AuthRepositoryImpl(new AuthRemoteDataSource());

export const ForgotPinScreen: React.FC = () => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [step, setStep] = useState<'mobile' | 'verify'>('mobile');
  const [mobile, setMobile] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(120);
  const [canResend, setCanResend] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const resetPinWithOtp = useAuthStore((state) => state.resetPinWithOtp);
  const setAuthMode = useAuthStore((state) => state.setAuthMode);

  const isSmallWidth = windowWidth < 380;
  const isTablet = Math.min(windowWidth, windowHeight) >= 600;
  const cardWidth = isTablet ? 420 : Math.min(windowWidth - 40, 390);

  // Resend OTP timer
  useEffect(() => {
    if (step !== 'verify' || resendTimer <= 0) {
      setCanResend(step === 'verify' && resendTimer <= 0);
      return;
    }
    const timer = setInterval(() => {
      setResendTimer((val) => (val <= 1 ? 0 : val - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, resendTimer]);

  const formatTimer = (seconds: number) =>
    `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  const handleMobileChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 10);
    setMobile(cleaned);
    if (errorMsg) setErrorMsg(null);
  };

  const handleOtpChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
    setOtpCode(cleaned);
    if (errorMsg) setErrorMsg(null);
  };

  const handleNewPinChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
    setNewPin(cleaned);
    if (errorMsg) setErrorMsg(null);
  };

  const handleConfirmNewPinChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
    setConfirmNewPin(cleaned);
    if (errorMsg) setErrorMsg(null);
  };

  // Step 1: Send OTP to registered mobile
  const handleSendOtp = async () => {
    if (loading) return;
    if (mobile.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit registered mobile number.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      logger.auth('OTP_REQUEST_STARTED', 'Sending OTP for PIN recovery', {
        mobile: maskMobile(mobile),
      });
      const res = await authRepository.generateOtp(mobile);
      setStep('verify');
      setResendTimer(120);
      setCanResend(false);

      if (res?.otpCode && /^\d{6}$/.test(res.otpCode)) {
        setOtpCode(res.otpCode);
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
    if (loading || !canResend) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await authRepository.generateOtp(mobile);
      setResendTimer(120);
      setCanResend(false);
      if (res?.otpCode && /^\d{6}$/.test(res.otpCode)) {
        setOtpCode(res.otpCode);
      }
    } catch (err: any) {
      setErrorMsg(getAuthErrorMessage(err, 'resend_otp'));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and save new PIN
  const handleResetSubmit = async () => {
    if (loading) return;

    if (otpCode.length !== 6) {
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
      setLoading(true);
      setErrorMsg(null);
      logger.auth('OTP_VERIFICATION_STARTED', 'Submitting OTP and new PIN');
      const result = await resetPinWithOtp(mobile, otpCode, newPin);
      if (!result.success) {
        setErrorMsg(result.message || 'Failed to reset PIN. Invalid or expired OTP.');
      }
      // On success, resetPinWithOtp sets isAuthenticated: true, isPinLocked: false, and authMode: 'pin'
    } catch (err: any) {
      logger.auth('OTP_VERIFICATION_FAILED', 'Failed to reset PIN', { error: err?.message });
      setErrorMsg(err?.message || 'Failed to reset PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flexOne}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.centerContainer}>
              <View style={[styles.card, { width: cardWidth }]}>
                {/* Back button */}
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => {
                    if (step === 'verify') {
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
                    {step === 'verify' ? 'Change mobile number' : 'Back to PIN'}
                  </Text>
                </TouchableOpacity>

                {/* Header Icon */}
                <View style={styles.iconCircle}>
                  <RotateCcw size={26} color="#DE8626" />
                </View>

                {/* Title & Subtitle */}
                <Text style={styles.title}>
                  {step === 'mobile' ? 'Forgot Staff PIN' : 'Reset Staff PIN'}
                </Text>
                <Text style={styles.subtitle}>
                  {step === 'mobile'
                    ? 'Enter your registered mobile number to receive a 6-digit verification code'
                    : `Enter the code sent to +91 ${mobile} and set a new 4-digit PIN`}
                </Text>

                {/* Error Banner */}
                {errorMsg && (
                  <View style={styles.errorBanner}>
                    <AlertCircle size={15} color="#DC2626" />
                    <Text style={styles.errorBannerText}>{errorMsg}</Text>
                  </View>
                )}

                {step === 'mobile' ? (
                  /* Step 1: Mobile Entry */
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
                          style={styles.mobileInput}
                          value={mobile}
                          onChangeText={handleMobileChange}
                          onFocus={() => setFocusedInput('mobile')}
                          onBlur={() => setFocusedInput(null)}
                          placeholder="10-digit mobile"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="phone-pad"
                          maxLength={10}
                          autoFocus
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
                ) : (
                  /* Step 2: OTP & New PIN Entry */
                  <View style={styles.fullWidth}>
                    {/* 6-Digit OTP */}
                    <View style={styles.formGroup}>
                      <Text style={styles.inputLabel}>6-Digit OTP Code</Text>
                      <View
                        style={[
                          styles.inputWrapper,
                          focusedInput === 'otp' && styles.inputWrapperFocused,
                        ]}
                      >
                        <TextInput
                          style={styles.otpInput}
                          value={otpCode}
                          onChangeText={handleOtpChange}
                          onFocus={() => setFocusedInput('otp')}
                          onBlur={() => setFocusedInput(null)}
                          placeholder="••••••"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                          maxLength={6}
                          autoFocus
                        />
                      </View>
                      {/* Resend Link */}
                      <View style={styles.resendRow}>
                        <Text style={styles.resendPrompt}>Didn't receive code? </Text>
                        {canResend ? (
                          <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                            <Text style={styles.resendActiveText}>Resend OTP</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.resendTimerText}>
                            Resend in {formatTimer(resendTimer)}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* New PIN */}
                    <View style={styles.formGroup}>
                      <Text style={styles.inputLabel}>New 4-Digit PIN</Text>
                      <View
                        style={[
                          styles.inputWrapper,
                          focusedInput === 'newPin' && styles.inputWrapperFocused,
                        ]}
                      >
                        <TextInput
                          style={styles.pinInput}
                          value={newPin}
                          onChangeText={handleNewPinChange}
                          onFocus={() => setFocusedInput('newPin')}
                          onBlur={() => setFocusedInput(null)}
                          placeholder="••••"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                          secureTextEntry
                          maxLength={4}
                        />
                      </View>
                    </View>

                    {/* Confirm New PIN */}
                    <View style={styles.formGroup}>
                      <Text style={styles.inputLabel}>Confirm New 4-Digit PIN</Text>
                      <View
                        style={[
                          styles.inputWrapper,
                          focusedInput === 'confirmNewPin' && styles.inputWrapperFocused,
                        ]}
                      >
                        <TextInput
                          style={styles.pinInput}
                          value={confirmNewPin}
                          onChangeText={handleConfirmNewPinChange}
                          onFocus={() => setFocusedInput('confirmNewPin')}
                          onBlur={() => setFocusedInput(null)}
                          placeholder="••••"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                          secureTextEntry
                          maxLength={4}
                        />
                      </View>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                      style={[
                        styles.primaryBtn,
                        (otpCode.length !== 6 ||
                          newPin.length !== 4 ||
                          confirmNewPin.length !== 4 ||
                          loading) &&
                          styles.primaryBtnDisabled,
                      ]}
                      onPress={handleResetSubmit}
                      disabled={
                        otpCode.length !== 6 ||
                        newPin.length !== 4 ||
                        confirmNewPin.length !== 4 ||
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
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
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
  inputWrapper: {
    width: '100%',
    height: 52,
    backgroundColor: '#FAF7F2',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
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
  otpInput: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 6,
    color: '#1E2930',
  },
  pinInput: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 8,
    color: '#1E2930',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
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
});