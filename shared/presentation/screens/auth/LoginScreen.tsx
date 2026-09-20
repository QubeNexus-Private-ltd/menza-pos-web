import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Image,
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
  ChevronDown,
  ChevronRight,
  Store,
  Scale,
  ShieldCheck,
} from 'lucide-react-native';
import { APP_CONSTANTS } from '../../../core/constants/appConstants';
import { logger, maskMobile } from '../../../core/logging';
import { AuthRemoteDataSource } from '../../../data/datasources/AuthRemoteDataSource';
import { AuthRepositoryImpl } from '../../../data/repositories/AuthRepositoryImpl';
import { useAuthStore } from '../../state/useAuthStore';
import { TermsAndConditionsModal } from '../legal/TermsAndConditionsModal';

const authRepository = new AuthRepositoryImpl(new AuthRemoteDataSource());

// Exact aspect ratio from NewLogin.png (852 × 1846)
const DESIGN_WIDTH = 852;
const DESIGN_HEIGHT = 1846;
const DESIGN_ASPECT_RATIO = DESIGN_WIDTH / DESIGN_HEIGHT;

export const LoginScreen: React.FC = () => {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [loginMode, setLoginMode] = useState<'mobile' | 'outlet'>('mobile');
  const [mobile, setMobile] = useState('');
  const [outletCode, setOutletCode] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [focusedInput, setFocusedInput] = useState<'mobile' | 'otp' | 'outlet' | null>(null);
  const [resendTimer, setResendTimer] = useState(120);
  const [canResend, setCanResend] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);

  const entranceAnim = useRef(new Animated.Value(0)).current;
  const setAuthData = useAuthStore((state) => state.setAuthData);

  useEffect(() => {
    logger.navigation('LoginScreen');
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [entranceAnim]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isOtpSent) {
        handleBackToMobile();
        return true;
      }
      if (loginMode === 'outlet') {
        setLoginMode('mobile');
        setErrorMsg(null);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [isOtpSent, loginMode]);

  useEffect(() => {
    if (!isOtpSent || resendTimer <= 0) {
      setCanResend(isOtpSent && resendTimer <= 0);
      return;
    }
    const timer = setInterval(() => {
      setResendTimer((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOtpSent, resendTimer]);

  const formatTimer = (seconds: number) =>
    `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  const handleMobileChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 10);
    setMobile(cleaned);
    if (errorMsg) setErrorMsg(null);
    if (cleaned.length === 10 && !loading) {
      Keyboard.dismiss();
      setTimeout(() => handleSendOtp(cleaned), 120);
    }
  };

  const handleOtpChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
    setOtpCode(cleaned);
    if (errorMsg) setErrorMsg(null);
    if (cleaned.length === 6 && !loading) {
      Keyboard.dismiss();
      setTimeout(() => handleVerifyOtp(cleaned), 120);
    }
  };

  const handleSendOtp = async (overrideMobile?: string) => {
    if (loading) return;

    const mobileToUse = overrideMobile || mobile;
    if (mobileToUse.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      logger.auth('OTP_REQUEST_STARTED', 'Initiating OTP request', {
        mobile: maskMobile(mobileToUse),
      });
      await authRepository.generateOtp(mobileToUse);
      setIsOtpSent(true);
      setResendTimer(120);
      setCanResend(false);
      logger.auth('OTP_REQUEST_SUCCESS', 'OTP generation request completed successfully');
    } catch (err: any) {
      logger.auth('OTP_REQUEST_FAILED', 'OTP generation request failed', {
        error: err.message,
      });
      setErrorMsg(
        err.message || 'Unable to send OTP. Please check your mobile number and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (codeOverride?: string) => {
    if (loading) return;

    const codeToVerify = codeOverride || otpCode;
    if (codeToVerify.length !== 6) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      logger.auth('OTP_VERIFICATION_STARTED', 'Submitting OTP for verification');
      const res = await authRepository.loginWithOtp(mobile, codeToVerify);
      setAuthData(
        res.token,
        res.refreshToken,
        {
          id: res.userId,
          name: res.name,
          mobile: res.mobile,
          roles: res.roles,
          activeRestaurantId: res.activeRestaurantId,
        },
        res.restaurants,
        res.activeRestaurantId
      );
    } catch (err: any) {
      logger.auth(
        'OTP_VERIFICATION_FAILED',
        'OTP verification failed, proceeding with session',
        { error: err?.message }
      );
      setErrorMsg(
        err?.message ||
          'Invalid verification code. Please check the code and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOutletLogin = async () => {
    if (outletCode.trim().length < 4) {
      setErrorMsg('Please enter a valid outlet code.');
      return;
    }
    setErrorMsg('Direct outlet code login has been upgraded to secure Mobile OTP authentication. Please switch to Mobile Login.');
  };

  const handleBackToMobile = () => {
    setIsOtpSent(false);
    setOtpCode('');
    setErrorMsg(null);
    setResendTimer(120);
    setCanResend(false);
  };

  // Compute responsive canvas preserving exact proportions across phones, tablets & desktop
  let canvasWidth = windowWidth;
  let canvasHeight = windowWidth / DESIGN_ASPECT_RATIO;

  if (canvasHeight > windowHeight) {
    canvasHeight = windowHeight;
    canvasWidth = windowHeight * DESIGN_ASPECT_RATIO;
  }

  const pillWidth = Math.min(canvasWidth * 0.88, 420);
  const topHeaderSpacing = canvasHeight * 0.485;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" translucent />

      {/* Main Single Source of Truth Canvas */}
      <View
        style={[
          styles.canvasContainer,
          {
            width: canvasWidth,
            height: canvasHeight,
          },
        ]}
      >
        {/* Exact background artwork matching NewLogin.png */}
        <Image
          source={require('../../../../assets/menza_login_canvas_bg.png')}
          style={styles.fullImage}
          resizeMode="contain"
          accessibilityLabel="Menza — Order, Dine, Delight"
        />

        {/* Interactive Layer positioned over the canvas */}
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
            style={styles.keyboardView}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              contentContainerStyle={[
                styles.scrollContent,
                isOtpSent && styles.otpScrollContent,
              ]}
              showsVerticalScrollIndicator={false}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <Animated.View
                  style={[
                    styles.mainContainer,
                    {
                      opacity: entranceAnim,
                    },
                  ]}
                >
                  {/* Spacer reserving the top logo & lamps area matching NewLogin.png */}
                  <View style={{ 
                    height: isOtpSent ? Math.max(canvasHeight * 0.38,180) : topHeaderSpacing, 
                    }}   
                  />

                  {/* Inline Error Banner */}
                  {errorMsg ? (
                    <View
                      accessibilityRole="alert"
                      style={[styles.errorBanner, { width: pillWidth }]}
                    >
                      <AlertCircle size={17} color="#DC2626" />
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                  ) : null}

                  {isOtpSent ? (
                    /* OTP Verification Card State */
                    <View style={[styles.cardContainer, { width: pillWidth }]}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={handleBackToMobile}
                        style={styles.backLinkRow}
                      >
                        <ArrowLeft size={16} color="#D96B14" />
                        <Text style={styles.backLinkText}>Change mobile number</Text>
                      </TouchableOpacity>

                      <Text style={styles.cardHeading}>Verify your number</Text>
                      <Text style={styles.cardSubheading}>
                        Enter the code sent to +91 {mobile}
                      </Text>

                      <View
                        style={[
                          styles.otpInputWrapper,
                          focusedInput === 'otp' && styles.inputWrapperFocused,
                        ]}
                      >
                        <TextInput
                          accessibilityLabel="One-time verification code"
                          value={otpCode}
                          onChangeText={handleOtpChange}
                          onFocus={() => setFocusedInput('otp')}
                          onBlur={() => setFocusedInput(null)}
                          placeholder="Enter 6-digit OTP"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                          autoComplete="sms-otp"
                          textContentType="oneTimeCode"
                          maxLength={6}
                          autoFocus
                          secureTextEntry
                          style={styles.otpInput}
                        />
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={() => handleVerifyOtp()}
                        disabled={loading}
                        style={styles.continueButton}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Text style={styles.continueButtonText}>Verify & continue</Text>
                            <ArrowRight size={18} color="#FFFFFF" style={styles.continueIcon} />
                          </>
                        )}
                      </TouchableOpacity>

                      <View style={styles.resendRow}>
                        <Text style={styles.resendPrompt}>Didn't receive a code?</Text>
                        {canResend ? (
                          <TouchableOpacity onPress={() => handleSendOtp()} disabled={loading}>
                            <Text style={styles.resendActiveText}>Resend OTP</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.resendTimerText}>
                            Resend in {formatTimer(resendTimer)}
                          </Text>
                        )}
                      </View>
                    </View>
                  ) : loginMode === 'outlet' ? (
                    /* Outlet Code Login Card State */
                    <View style={[styles.cardContainer, { width: pillWidth }]}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => {
                          setLoginMode('mobile');
                          setErrorMsg(null);
                        }}
                        style={styles.backLinkRow}
                      >
                        <ArrowLeft size={16} color="#D96B14" />
                        <Text style={styles.backLinkText}>Back to mobile login</Text>
                      </TouchableOpacity>

                      <Text style={styles.cardHeading}>Enter Outlet Code</Text>
                      <Text style={styles.cardSubheading}>
                        Fast-login for cashiers and store terminals
                      </Text>

                      <View
                        style={[
                          styles.outletInputWrapper,
                          focusedInput === 'outlet' && styles.inputWrapperFocused,
                        ]}
                      >
                        <Store size={18} color="#9CA3AF" style={{ marginLeft: 14 }} />
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={handleOutletLogin}
                        disabled={loading}
                        style={styles.continueButton}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Text style={styles.continueButtonText}>Continue to Outlet</Text>
                            <ArrowRight size={18} color="#FFFFFF" style={styles.continueIcon} />
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    /* Exact NewLogin.png Floating Capsule Input Bar */
                    <View style={styles.floatingPillSection}>
                      <View
                        style={[
                          styles.floatingPill,
                          { width: pillWidth },
                          focusedInput === 'mobile' && styles.floatingPillFocused,
                        ]}
                      >
                        {/* Country Code Selector: 🇮🇳 +91 v | */}
                        <View style={styles.countryPickerAdornment}>
                          <Text style={styles.flagEmoji}>🇮🇳</Text>
                          <Text style={styles.countryCodeText}>+91</Text>
                          <ChevronDown size={14} color="#6B7280" style={styles.chevronIcon} />
                          <View style={styles.inputDividerLine} />
                        </View>

                        {/* Mobile Number Input */}
                        <TextInput
                          accessibilityLabel="Mobile number"
                          value={mobile}
                          onChangeText={handleMobileChange}
                          onFocus={() => setFocusedInput('mobile')}
                          onBlur={() => setFocusedInput(null)}
                          placeholder="Enter mobile number"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="phone-pad"
                          autoComplete="tel"
                          textContentType="telephoneNumber"
                          maxLength={10}
                          style={styles.textInput}
                        />

                        {/* Right Orange Chevron Arrow Button */}
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => handleSendOtp()}
                          disabled={loading}
                          style={styles.chevronActionBtn}
                          accessibilityLabel="Continue"
                          accessibilityRole="button"
                        >
                          {loading ? (
                            <ActivityIndicator size="small" color="#E08726" />
                          ) : (
                            <ChevronRight size={26} color="#E08726" strokeWidth={2.4} />
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* Subtle Outlet Code Alternative Link */}
                      <TouchableOpacity
                        activeOpacity={0.78}
                        onPress={() => {
                          setLoginMode('outlet');
                          setErrorMsg(null);
                        }}
                        style={styles.outletModeLink}
                      >
                        <Store size={15} color="#8C7A6B" style={{ marginRight: 6 }} />
                        <Text style={styles.outletModeText}>
                          Sign in with Outlet Code / Cashier PIN
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Legal Terms & Conditions Notice */}
                  <TouchableOpacity
                    onPress={() => setTermsModalVisible(true)}
                    activeOpacity={0.75}
                    style={styles.termsFooterLink}
                  >
                    <Scale size={13} color="#A8A29E" style={{ marginRight: 5 }} />
                    <Text style={styles.termsFooterText}>
                      By signing in, you agree to Menza's{' '}
                      <Text style={styles.termsFooterHighlight}>Terms & Conditions, Rules and Regulations</Text>
                    </Text>
                  </TouchableOpacity>

                  {/* Bottom Safety Margin */}
                  <View style={{ height: Math.max(canvasHeight * 0.08, 40) }} />
                </Animated.View>
              </TouchableWithoutFeedback>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>

      {/* Terms and Conditions Modal */}
      <TermsAndConditionsModal
        visible={termsModalVisible}
        onClose={() => setTermsModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  otpScrollContent: {
    paddingBottom:  180,
  },
  root: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  canvasContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FAF7F2',
  },
  fullImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  safeArea: {
    flex: 1,
    width: '100%',
  },
  keyboardView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  mainContainer: {
    width: '100%',
    alignItems: 'center',
  },
  floatingPillSection: {
    alignItems: 'center',
    width: '100%',
  },
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFFFFF',
    paddingLeft: 18,
    paddingRight: 14,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(235, 230, 222, 0.75)',
  },
  floatingPillFocused: {
    borderColor: '#E08726',
    borderWidth: 1.5,
    shadowOpacity: 0.2,
  },
  countryPickerAdornment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagEmoji: {
    fontSize: 20,
    marginRight: 6,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  chevronIcon: {
    marginLeft: 3,
    marginRight: 10,
  },
  inputDividerLine: {
    width: 1,
    height: 26,
    backgroundColor: '#E5E7EB',
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    paddingRight: 10,
  },
  chevronActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outletModeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  outletModeText: {
    color: '#7C6F62',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(231, 225, 218, 0.45)',
  },
  cardHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  cardSubheading: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
  },
  otpInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  outletInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputWrapperFocused: {
    borderColor: '#D96B14',
    borderWidth: 1.5,
  },
  otpInput: {
    flex: 1,
    height: '100%',
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    letterSpacing: 6,
  },
  continueButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#D96B14',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  continueIcon: {
    marginLeft: 8,
  },
  backLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backLinkText: {
    color: '#D96B14',
    fontSize: 13,
    fontWeight: '600',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 16,
  },
  resendPrompt: {
    color: '#6B7280',
    fontSize: 13,
  },
  resendActiveText: {
    color: '#D96B14',
    fontSize: 13,
    fontWeight: '700',
  },
  resendTimerText: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  termsFooterLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 24,
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

