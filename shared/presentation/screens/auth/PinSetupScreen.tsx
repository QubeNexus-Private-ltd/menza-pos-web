import React, { useState } from 'react';
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
  ArrowRight,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import { useAuthStore } from '../../state/useAuthStore';
import { logger } from '../../../core/logging';

export const PinSetupScreen: React.FC = () => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'pin' | 'confirm' | null>(null);

  const completePinSetup = useAuthStore((state) => state.completePinSetup);
  const activeStaffName = useAuthStore((state) => state.activeStaffName);
  const user = useAuthStore((state) => state.user);

  const isSmallWidth = windowWidth < 380;
  const isTablet = Math.min(windowWidth, windowHeight) >= 600;
  const cardWidth = isTablet ? 420 : Math.min(windowWidth - 40, 380);

  const handlePinChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(cleaned);
    if (errorMsg) setErrorMsg(null);
  };

  const handleConfirmPinChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
    setConfirmPin(cleaned);
    if (errorMsg) setErrorMsg(null);
  };

  const handleSubmit = async () => {
    if (loading) return;

    if (pin.length !== 4) {
      setErrorMsg('Please enter a 4-digit PIN.');
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
                {/* Header Icon */}
                <View style={styles.iconCircle}>
                  <KeyRound size={28} color="#DE8626" />
                </View>

                {/* Title & Subtitle */}
                <Text style={styles.title}>Set Up Your POS PIN</Text>
                <Text style={styles.welcomeText}>Welcome, {displayName}</Text>
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

                {/* Form Inputs */}
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>New 4-Digit PIN</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      focusedInput === 'pin' && styles.inputWrapperFocused,
                    ]}
                  >
                    <TextInput
                      style={styles.textInput}
                      value={pin}
                      onChangeText={handlePinChange}
                      onFocus={() => setFocusedInput('pin')}
                      onBlur={() => setFocusedInput(null)}
                      placeholder="••••"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={4}
                      autoFocus
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Confirm 4-Digit PIN</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      focusedInput === 'confirm' && styles.inputWrapperFocused,
                    ]}
                  >
                    <TextInput
                      style={styles.textInput}
                      value={confirmPin}
                      onChangeText={handleConfirmPinChange}
                      onFocus={() => setFocusedInput('confirm')}
                      onBlur={() => setFocusedInput(null)}
                      placeholder="••••"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={4}
                    />
                  </View>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    (pin.length !== 4 || confirmPin.length !== 4 || loading) && styles.primaryBtnDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={pin.length !== 4 || confirmPin.length !== 4 || loading}
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
              </View>

              {/* Security Hint */}
              <View style={styles.securityHint}>
                <ShieldCheck size={13} color="#9CA3AF" />
                <Text style={styles.securityHintText}>
                  Your PIN is securely hashed & stored per terminal
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
  welcomeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D96B14',
    marginTop: 3,
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
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
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
  textInput: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 8,
    color: '#1E2930',
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
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
    marginTop: 18,
  },
  securityHintText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});