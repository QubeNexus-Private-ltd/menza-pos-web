import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
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
  ChevronDown,
  ChevronRight,
  Copy,
  MessageSquare,
  Scale,
  Sparkles,
} from 'lucide-react-native';
import { APP_CONSTANTS } from '../../../core/constants/appConstants';
import { logger, maskMobile } from '../../../core/logging';
import { AuthRemoteDataSource } from '../../../data/datasources/AuthRemoteDataSource';
import { AuthRepositoryImpl } from '../../../data/repositories/AuthRepositoryImpl';
import { TermsConditionRemoteDataSource } from '../../../data/datasources/TermsConditionRemoteDataSource';
import { TermsConditionRepositoryImpl } from '../../../data/repositories/TermsConditionRepositoryImpl';
import { useAuthStore } from '../../state/useAuthStore';
import { useAutoVerifyOtp } from '../../hooks/useAutoVerifyOtp';
import { TermsAndConditionsModal } from '../legal/TermsAndConditionsModal';
import { LoginHeader } from './components/LoginHeader';
import { LoginBottomWaveSvg } from './components/LoginBottomWaveSvg';
import { LoginSvgBackground } from './components/LoginSvgBackground';

const authRepository = new AuthRepositoryImpl(new AuthRemoteDataSource());
const termsRepository = new TermsConditionRepositoryImpl(new TermsConditionRemoteDataSource());

export const LoginScreen: React.FC = () => {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [mobile, setMobile] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [focusedInput, setFocusedInput] = useState<'mobile' | 'otp' | null>(null);
  const [resendTimer, setResendTimer] = useState(120);
  const [canResend, setCanResend] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const isVerifyingRef = useRef(false);
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const setAuthData = useAuthStore((state) => state.setAuthData);

  const {
    isListening,
    isAutoDetected,
    timeoutError,
    clipboardOtp,
    pasteClipboardOtp,
    startListening,
    stopListening,
  } = useAutoVerifyOtp({
    enabled: isOtpSent,
    numberOfDigits: 6,
    onOtpReceived: (detectedCode) => {
      setOtpCode(detectedCode);
      Keyboard.dismiss();
      setTimeout(() => {
        handleVerifyOtp(detectedCode);
      }, 150);
    },
  });

  useEffect(() => {
    logger.navigation('LoginScreen');
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [entranceAnim]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = () => setIsKeyboardVisible(true);
    const onHide = () => setIsKeyboardVisible(false);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isOtpSent) {
        handleBackToMobile();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [isOtpSent]);

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
    if (cleaned.length === 6 && !loading && !isVerifyingRef.current) {
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
      const otpRes = await authRepository.generateOtp(mobileToUse);
      setIsOtpSent(true);
      setResendTimer(120);
      setCanResend(false);
      startListening();
      logger.auth('OTP_REQUEST_SUCCESS', 'OTP generation request completed successfully');

      // Immediate auto-fill & verify if backend provides otpCode (dev/demo/direct)
      if (otpRes?.otpCode && /^\d{6}$/.test(otpRes.otpCode)) {
        setOtpCode(otpRes.otpCode);
        Keyboard.dismiss();
        setTimeout(() => handleVerifyOtp(otpRes.otpCode), 250);
      }
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

  const handleResendOtp = async () => {
    if (loading || !canResend) return;
    setErrorMsg(null);
    try {
      setLoading(true);
      logger.auth('OTP_REQUEST_STARTED', 'Resending OTP request', {
        mobile: maskMobile(mobile),
      });
      const res = await authRepository.generateOtp(mobile);
      setResendTimer(120);
      setCanResend(false);
      startListening();
      logger.auth('OTP_REQUEST_SUCCESS', 'Resent OTP successfully');

      if (res?.otpCode && /^\d{6}$/.test(res.otpCode)) {
        setOtpCode(res.otpCode);
        Keyboard.dismiss();
        setTimeout(() => handleVerifyOtp(res.otpCode), 250);
      }
    } catch (err: any) {
      logger.auth('OTP_REQUEST_FAILED', 'Resend OTP failed', { error: err.message });
      setErrorMsg(err.message || 'Unable to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (codeOverride?: string) => {
    if (isVerifyingRef.current || loading) return;

    const codeToVerify = codeOverride || otpCode;
    if (codeToVerify.length !== 6) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }
    try {
      isVerifyingRef.current = true;
      setLoading(true);
      setErrorMsg(null);
      logger.auth('OTP_VERIFICATION_STARTED', 'Submitting OTP for verification');
      const res = await authRepository.loginWithOtp(mobile, codeToVerify);
      logger.auth('OTP_VERIFICATION_SUCCESS', 'OTP verification completed successfully');

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
        res.activeRestaurantId,
        res.isTermConditionChecked
      );
    } catch (err: any) {
      logger.auth(
        'OTP_VERIFICATION_FAILED',
        'OTP verification failed',
        { error: err?.message }
      );
      setErrorMsg(
        err?.message ||
          'Invalid verification code. Please check the code and try again.'
      );
    } finally {
      isVerifyingRef.current = false;
      setLoading(false);
    }
  };

  const handleBackToMobile = () => {
    stopListening();
    setIsOtpSent(false);
    setOtpCode('');
    setErrorMsg(null);
    setResendTimer(120);
    setCanResend(false);
  };

  // Responsive device dimensions and breakpoints
  const minDimension = Math.min(windowWidth, windowHeight);
  const isTablet = minDimension >= 600;
  const isLandscapePhone = windowWidth > windowHeight && !isTablet;
  const isSmallWidth = windowWidth < 380;
  const isSmallHeight = windowHeight < 700;
  const isSmallScreen = isSmallWidth || isSmallHeight;

  // Responsive max content width constraint (prevents overstretching on tablets while filling phones)
  const contentWidth = isTablet
    ? 440
    : Math.min(windowWidth - (isSmallWidth ? 28 : 40), 430);

  // Responsive Header height estimation for balancing
  const LOGO_ASPECT_RATIO = 470 / 492;
  const isCompactHeader = isOtpSent || isKeyboardVisible || isSmallHeight || isLandscapePhone;

  let logoWidth = Math.min(
    windowWidth * (isLandscapePhone ? 0.25 : isSmallScreen ? 0.48 : isTablet ? 0.32 : 0.54),
    isLandscapePhone ? 120 : isCompactHeader ? 150 : isSmallScreen ? 180 : isTablet ? 260 : 224
  );
  if (isCompactHeader && !isLandscapePhone) {
    logoWidth = Math.min(logoWidth, 150);
  }
  const logoHeight = logoWidth * LOGO_ASPECT_RATIO;

  const estimatedHeaderHeight = isLandscapePhone
    ? Math.max(logoHeight + 16, 105)
    : isCompactHeader
    ? Math.max(logoHeight + 20, 140)
    : isSmallScreen
    ? Math.max(logoHeight + 36, 175)
    : isTablet
    ? Math.max(logoHeight + 60, 240)
    : Math.min(windowHeight * 0.30, Math.max(logoHeight + 48, 215));

  // Responsive Wave height
  const waveHeight = isLandscapePhone
    ? 90
    : isSmallScreen
    ? 135
    : isTablet
    ? 200
    : 170;

  // Estimated form height depending on mode
  const estimatedFormHeight = isOtpSent
    ? (isSmallScreen ? 270 : 310)
    : (isSmallScreen ? 95 : 115);

  // Dynamic vertical slack space distributed smoothly
  const totalOccupiedHeight = estimatedHeaderHeight + estimatedFormHeight + waveHeight;
  const slackHeight = Math.max(0, windowHeight - totalOccupiedHeight);

  // Distribute spacing so the number section rests in the balanced vertical center (~47-50% height)
  // and smoothly shifts up when keyboard opens or orientation changes
  let targetTopSpacer = 16;
  let targetBottomSpacer = 16;

  if (isKeyboardVisible || isLandscapePhone) {
    targetTopSpacer = isOtpSent ? 8 : 14;
    targetBottomSpacer = 14;
  } else if (isOtpSent) {
    targetTopSpacer = Math.max(12, Math.round(slackHeight * 0.34));
    targetBottomSpacer = Math.max(16, slackHeight - targetTopSpacer);
  } else {
    // Standard phone mobile login resting state:
    // 44% of available vertical slack placed above, 56% below.
    // Perfectly aligns mobile input pill at ~47-50% screen height!
    targetTopSpacer = Math.max(20, Math.round(slackHeight * 0.44));
    targetBottomSpacer = Math.max(24, slackHeight - targetTopSpacer);
  }

  const topSpacerAnim = useRef(new Animated.Value(targetTopSpacer)).current;
  const bottomSpacerAnim = useRef(new Animated.Value(targetBottomSpacer)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(topSpacerAnim, {
        toValue: targetTopSpacer,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(bottomSpacerAnim, {
        toValue: targetBottomSpacer,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [targetTopSpacer, targetBottomSpacer, topSpacerAnim, bottomSpacerAnim]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" translucent />

      {/* 
        Full-screen SVG Background:
        Draws vector porcelain gradients and ambient lamp lighting that scales fluidly
        to any screen aspect ratio (long, short, phones, tablets).
      */}
      <LoginSvgBackground width={windowWidth} height={windowHeight} />

      {/* Main Interactive Screen Layer */}
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            contentContainerStyle={[
              styles.scrollContent,
              {
                minHeight:
                  windowHeight -
                  (Platform.OS === 'android' && StatusBar.currentHeight
                    ? StatusBar.currentHeight
                    : 0),
              },
            ]}
            showsVerticalScrollIndicator={false}
            bounces={false}
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
                {/* 
                  1. Responsive Vector Header:
                  Contains ambient lighting, hanging lamps, and crisp Menza Cloche logo
                  that scales proportionally on long, short, and tablet screens.
                */}
                <LoginHeader compact={isCompactHeader} />

                {/* Dynamic Top Animated Spacer: gracefully centers number input and glides up on keyboard focus */}
                <Animated.View style={{ height: topSpacerAnim }} />

                {/* 
                  2. Centered Form Container:
                  Uses responsive max-width so it fills mobile screens cleanly
                  and remains an elegant centered card on tablets.
                */}
                <View style={[styles.formContainer, { width: contentWidth }]}>
                  {/* Inline Error Alert Banner */}
                  {errorMsg ? (
                    <View accessibilityRole="alert" style={styles.errorBanner}>
                      <AlertCircle size={16} color="#DC2626" />
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                  ) : null}

                  {isOtpSent ? (
                    /* OTP Verification Card State */
                    <View style={[styles.cardContainer, isSmallScreen && styles.cardContainerSmall]}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={handleBackToMobile}
                        style={styles.backLinkRow}
                      >
                        <ArrowLeft size={16} color="#D96B14" />
                        <Text style={styles.backLinkText}>Change mobile number</Text>
                      </TouchableOpacity>

                      <Text style={[styles.cardHeading, isSmallScreen && styles.cardHeadingSmall]}>
                        Verify your number
                      </Text>
                      <Text style={[styles.cardSubheading, isSmallScreen && styles.cardSubheadingSmall]}>
                        Enter the code sent to +91 {mobile}
                      </Text>

                      {/* Auto-Verify Status Banner */}
                      {isAutoDetected ? (
                        <View style={[styles.autoVerifyStatusBanner, styles.autoVerifyStatusSuccess]}>
                          <CheckCircle2 size={15} color="#17845A" />
                          <Text style={styles.autoVerifyStatusTextSuccess}>
                            SMS code detected • Auto-verifying...
                          </Text>
                        </View>
                      ) : isListening ? (
                        <View style={styles.autoVerifyStatusBanner}>
                          <ActivityIndicator size="small" color="#17845A" style={{ transform: [{ scale: 0.8 }] }} />
                          <Text style={styles.autoVerifyStatusText}>
                            Auto-detecting OTP from incoming SMS...
                          </Text>
                        </View>
                      ) : timeoutError ? (
                        <View style={[styles.autoVerifyStatusBanner, styles.autoVerifyStatusMuted]}>
                          <MessageSquare size={14} color="#6B7280" />
                          <Text style={styles.autoVerifyStatusTextMuted}>
                            Auto-detect timed out. Please enter code manually.
                          </Text>
                        </View>
                      ) : Platform.OS === 'ios' ? (
                        <View style={[styles.autoVerifyStatusBanner, styles.autoVerifyStatusMuted]}>
                          <Sparkles size={14} color="#D96B14" />
                          <Text style={styles.autoVerifyStatusTextMuted}>
                            Tap code from SMS above keyboard to auto-fill
                          </Text>
                        </View>
                      ) : null}

                      {/* One-Tap Clipboard Paste Chip if 6-digit OTP detected on clipboard */}
                      {clipboardOtp && otpCode.length < 6 ? (
                        <TouchableOpacity
                          style={styles.clipboardChip}
                          onPress={pasteClipboardOtp}
                          activeOpacity={0.8}
                        >
                          <Copy size={13} color="#D96B14" />
                          <Text style={styles.clipboardChipText}>
                            Paste code from SMS:{' '}
                            <Text style={styles.clipboardChipBold}>{clipboardOtp}</Text>
                          </Text>
                        </TouchableOpacity>
                      ) : null}

                      {/* 6-Digit Responsive OTP Input */}
                      <View
                        style={[
                          styles.otpInputWrapper,
                          isSmallScreen && styles.otpInputWrapperSmall,
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
                          importantForAutofill="yes"
                          selectTextOnFocus
                          maxLength={6}
                          autoFocus
                          secureTextEntry={false}
                          style={[styles.otpInput, isSmallScreen && styles.otpInputSmall]}
                        />
                      </View>

                      {/* Verify Button */}
                      <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={() => handleVerifyOtp()}
                        disabled={loading}
                        style={[styles.continueButton, isSmallScreen && styles.continueButtonSmall]}
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

                      {/* Resend Countdown Row */}
                      <View style={styles.resendRow}>
                        <Text style={styles.resendPrompt}>Didn't receive a code?</Text>
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
                  ) : (
                    /* Floating Capsule Input Pill (Exact Menza Design) */
                    <View style={styles.floatingPillSection}>
                      <View
                        style={[
                          styles.floatingPill,
                          isSmallScreen && styles.floatingPillSmall,
                          focusedInput === 'mobile' && styles.floatingPillFocused,
                        ]}
                      >
                        {/* Country Code Selector: 🇮🇳 +91 v | */}
                        <View style={styles.countryPickerAdornment}>
                          <Text style={[styles.flagEmoji, isSmallWidth && styles.flagEmojiSmall]}>🇮🇳</Text>
                          <Text style={[styles.countryCodeText, isSmallWidth && styles.countryCodeTextSmall]}>+91</Text>
                          <ChevronDown size={isSmallWidth ? 12 : 14} color="#6B7280" style={styles.chevronIcon} />
                          <View style={styles.inputDividerLine} />
                        </View>

                        {/* Mobile Number Input with responsive styling preventing cutoff */}
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
                          style={[styles.textInput, isSmallWidth && styles.textInputSmall]}
                        />

                        {/* Right Orange Chevron Button */}
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => handleSendOtp()}
                          disabled={loading}
                          style={[styles.chevronActionBtn, isSmallWidth && styles.chevronActionBtnSmall]}
                          accessibilityLabel="Continue"
                          accessibilityRole="button"
                        >
                          {loading ? (
                            <ActivityIndicator size="small" color="#E08726" />
                          ) : (
                            <ChevronRight size={isSmallWidth ? 22 : 26} color="#E08726" strokeWidth={2.4} />
                          )}
                        </TouchableOpacity>
                      </View>
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
                </View>

                {/* Dynamic Bottom Animated Spacer: balances the screen and adapts to keyboard */}
                <Animated.View style={{ height: bottomSpacerAnim }} />

                {/* 
                  3. Responsive Vector SVG Bottom Wave:
                  Scales to 100% width on any screen with zero pixelation or distortion,
                  housing the trust badge "POWERING 1000+ RESTAURANTS".
                */}
                <LoginBottomWaveSvg
                  height={waveHeight}
                  showBadge={!isLandscapePhone}
                />
              </Animated.View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Terms and Conditions Modal */}
      <TermsAndConditionsModal
        visible={termsModalVisible}
        onClose={() => setTermsModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  mainContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  formContainer: {
    alignItems: 'center',
    alignSelf: 'center',
  },
  floatingPillSection: {
    alignItems: 'center',
    width: '100%',
  },
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    paddingLeft: 16,
    paddingRight: 10,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(235, 230, 222, 0.85)',
  },
  floatingPillSmall: {
    height: 54,
    borderRadius: 27,
    paddingLeft: 12,
    paddingRight: 8,
  },
  floatingPillFocused: {
    borderColor: '#E08726',
    borderWidth: 1.5,
    shadowOpacity: 0.18,
  },
  countryPickerAdornment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagEmoji: {
    fontSize: 19,
    marginRight: 5,
  },
  flagEmojiSmall: {
    fontSize: 16,
    marginRight: 4,
  },
  countryCodeText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#1F2937',
  },
  countryCodeTextSmall: {
    fontSize: 14,
  },
  chevronIcon: {
    marginLeft: 2,
    marginRight: 8,
  },
  inputDividerLine: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontSize: 15.5,
    fontWeight: '500',
    color: '#1F2937',
    paddingRight: 6,
    letterSpacing: 0.3,
  },
  textInputSmall: {
    fontSize: 14,
    paddingRight: 4,
  },
  chevronActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronActionBtnSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  cardContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(231, 225, 218, 0.55)',
  },
  cardContainerSmall: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  cardHeading: {
    fontSize: 21,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  cardHeadingSmall: {
    fontSize: 19,
  },
  cardSubheading: {
    fontSize: 13.5,
    color: '#6B7280',
    marginTop: 3,
    marginBottom: 16,
  },
  cardSubheadingSmall: {
    fontSize: 12.5,
    marginBottom: 14,
  },
  autoVerifyStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: '#EBF8F1',
    borderWidth: 1,
    borderColor: '#C6EEDB',
    marginBottom: 12,
  },
  autoVerifyStatusSuccess: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  autoVerifyStatusMuted: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  autoVerifyStatusText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#17845A',
    flex: 1,
  },
  autoVerifyStatusTextSuccess: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#15803D',
    flex: 1,
  },
  autoVerifyStatusTextMuted: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#6B7280',
    flex: 1,
  },
  clipboardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 12,
  },
  clipboardChipText: {
    fontSize: 11.5,
    color: '#92400E',
    fontWeight: '500',
  },
  clipboardChipBold: {
    fontWeight: '700',
    color: '#B45309',
    letterSpacing: 0.8,
  },
  errorBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 16,
  },
  otpInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  otpInputWrapperSmall: {
    height: 46,
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
  otpInputSmall: {
    fontSize: 16,
    letterSpacing: 4,
  },
  continueButton: {
    height: 48,
    borderRadius: 13,
    backgroundColor: '#D96B14',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    shadowColor: '#D96B14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  continueButtonSmall: {
    height: 44,
    borderRadius: 11,
    marginTop: 12,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  continueIcon: {
    marginLeft: 6,
  },
  backLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  backLinkText: {
    color: '#D96B14',
    fontSize: 12.5,
    fontWeight: '600',
  },
  resendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 14,
  },
  resendPrompt: {
    color: '#6B7280',
    fontSize: 12.5,
  },
  resendActiveText: {
    color: '#D96B14',
    fontSize: 12.5,
    fontWeight: '700',
  },
  resendTimerText: {
    color: '#9CA3AF',
    fontSize: 12.5,
  },
  termsFooterLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingHorizontal: 12,
  },
  termsFooterText: {
    fontSize: 11,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 15,
  },
  termsFooterHighlight: {
    color: '#D96B14',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
