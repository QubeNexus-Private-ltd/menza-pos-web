import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Lock,
  Delete,
  ShieldCheck,
  Store,
  LogOut,
  HelpCircle,
  Sparkles,
  Phone,
} from 'lucide-react-native';
import { useAuthStore } from '../../state/useAuthStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const PinLockScreen: React.FC = () => {
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');

  const activeRestaurant = useAuthStore((state) => state.activeRestaurant);
  const unlockWithPin = useAuthStore((state) => state.unlockWithPin);
  const logout = useAuthStore((state) => state.logout);
  const setAuthMode = useAuthStore((state) => state.setAuthMode);
  const activeStaffName = useAuthStore((state) => state.activeStaffName);
  const rememberedMobile = useAuthStore((state) => state.rememberedMobile);
  const user = useAuthStore((state) => state.user);

  const [mobile, setMobile] = useState<string>(rememberedMobile || user?.mobile || '');
  const [isEditingMobile, setIsEditingMobile] = useState<boolean>(!rememberedMobile && !user?.mobile);

  useEffect(() => {
    if (rememberedMobile && !mobile) {
      setMobile(rememberedMobile);
      setIsEditingMobile(false);
    }
  }, [rememberedMobile, mobile]);

  // Shake animation for incorrect PIN
  const shakeAnim = useRef(new Animated.Value(0)).current;

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

  const handleKeyPress = (val: string) => {
    if (pin.length >= 4) return;
    const nextPin = pin + val;
    setPin(nextPin);
    if (errorMsg) setErrorMsg(null);

    if (nextPin.length === 4) {
      setTimeout(async () => {
        const cleanMobile = (mobile || rememberedMobile || user?.mobile || '').replace(/[^0-9]/g, '').slice(-10);
        if (isEditingMobile && cleanMobile.length > 0 && cleanMobile.length !== 10) {
          setErrorMsg('Please enter a valid 10-digit mobile number.');
          return;
        }

        const result = await unlockWithPin(nextPin, cleanMobile);
        if (!result.success) {
          triggerShake();
          setErrorMsg(result.message || 'Incorrect PIN. Try again (Default: 1234)');
          setPin('');
        } else {
          setIsEditingMobile(false);
        }
      }, 100);
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      if (errorMsg) setErrorMsg(null);
    }
  };

  const handleClear = () => {
    setPin('');
    if (errorMsg) setErrorMsg(null);
  };

  const handleForgotPin = () => {
    setAuthMode('forgot_pin');
  };

  const handleSwitchToOtp = () => {
    setAuthMode('otp');
  };

  const restName = activeRestaurant?.restaurantName || 'Menza POS';
  const restSubtitle =
    activeRestaurant?.city || activeRestaurant?.address || 'Terminal Active';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      {/* Header Info */}
      <View style={styles.header}>
        <View style={styles.storeBadge}>
          <Store size={14} color="#DE8626" />
          <Text style={styles.storeBadgeText} numberOfLines={1}>
            {restName}
          </Text>
        </View>
        <Text style={styles.liveClock}>{currentTime}</Text>
      </View>

      {/* Central Card */}
      <View style={styles.centerContainer}>
        <View style={styles.lockIconCircle}>
          <Lock size={26} color="#DE8626" />
        </View>

        <Text style={styles.title}>Enter Staff PIN</Text>
        
        {rememberedMobile && !isEditingMobile ? (
          <View style={styles.operatorBadge}>
            <Phone size={12} color="#DE8626" />
            <Text style={styles.operatorText}>
              {activeStaffName || 'Operator'}: <Text style={styles.mobileText}>+91 {rememberedMobile}</Text>
            </Text>
            <TouchableOpacity
              onPress={() => {
                setMobile(rememberedMobile);
                setIsEditingMobile(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.switchText}>Switch</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.mobileInputRow}>
            <Text style={styles.mobileInputPrefix}>🇮🇳 +91</Text>
            <TextInput
              style={styles.mobileTextInput}
              value={mobile}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, '').slice(0, 10);
                setMobile(cleaned);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="10-digit mobile"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={10}
            />
            {rememberedMobile ? (
              <TouchableOpacity
                onPress={() => {
                  setMobile(rememberedMobile);
                  setIsEditingMobile(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* 4 Digit Indicators */}
        <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <View
                key={`pin-dot-${idx}`}
                style={[
                  styles.pinDot,
                  isFilled ? styles.pinDotFilled : styles.pinDotEmpty,
                ]}
              />
            );
          })}
        </Animated.View>

        {/* Error or Hint */}
        <View style={styles.messageBox}>
          {errorMsg ? (
            <Text style={styles.errorText}>{errorMsg}</Text>
          ) : (
            <Text style={styles.hintText}>Enter 4-digit PIN (Default: 1234)</Text>
          )}
        </View>

        {/* 3x4 Numeric Keypad */}
        <View style={styles.keypad}>
          {/* Row 1 */}
          <View style={styles.keypadRow}>
            {['1', '2', '3'].map((digit) => (
              <TouchableOpacity
                key={`btn-${digit}`}
                style={styles.keyBtn}
                onPress={() => handleKeyPress(digit)}
                activeOpacity={0.7}
              >
                <Text style={styles.keyBtnDigit}>{digit}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Row 2 */}
          <View style={styles.keypadRow}>
            {['4', '5', '6'].map((digit) => (
              <TouchableOpacity
                key={`btn-${digit}`}
                style={styles.keyBtn}
                onPress={() => handleKeyPress(digit)}
                activeOpacity={0.7}
              >
                <Text style={styles.keyBtnDigit}>{digit}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Row 3 */}
          <View style={styles.keypadRow}>
            {['7', '8', '9'].map((digit) => (
              <TouchableOpacity
                key={`btn-${digit}`}
                style={styles.keyBtn}
                onPress={() => handleKeyPress(digit)}
                activeOpacity={0.7}
              >
                <Text style={styles.keyBtnDigit}>{digit}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Row 4 */}
          <View style={styles.keypadRow}>
            <TouchableOpacity
              style={[styles.keyBtn, styles.actionKeyBtn]}
              onPress={handleClear}
              activeOpacity={0.7}
            >
              <Text style={styles.clearText}>CLR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.keyBtn}
              onPress={() => handleKeyPress('0')}
              activeOpacity={0.7}
            >
              <Text style={styles.keyBtnDigit}>0</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.keyBtn, styles.actionKeyBtn]}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Delete size={20} color="#667085" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Footer Navigation Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerBtn}
          onPress={handleSwitchToOtp}
          activeOpacity={0.7}
        >
          <LogOut size={13} color="#9CA3AF" />
          <Text style={styles.footerBtnText}>Switch / Owner Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerBtn}
          onPress={handleForgotPin}
          activeOpacity={0.7}
        >
          <HelpCircle size={13} color="#9CA3AF" />
          <Text style={styles.footerBtnText}>Forgot PIN?</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    maxWidth: '70%',
  },
  storeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D96B14',
  },
  liveClock: {
    fontSize: 13,
    fontWeight: '700',
    color: '#667085',
    fontFamily: 'monospace',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  lockIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF0DE',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E2930',
    letterSpacing: -0.3,
  },
  operatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 6,
  },
  operatorText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E2930',
  },
  mobileText: {
    fontWeight: '500',
    color: '#667085',
  },
  switchText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D96B14',
    textDecorationLine: 'underline',
    marginLeft: 4,
  },
  mobileInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    marginTop: 8,
    width: '100%',
    maxWidth: 260,
  },
  mobileInputPrefix: {
    fontSize: 12,
    fontWeight: '700',
    color: '#667085',
    marginRight: 6,
  },
  mobileTextInput: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    fontWeight: '700',
    color: '#1E2930',
    letterSpacing: 0.5,
    padding: 0,
  },
  cancelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginLeft: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#667085',
    marginTop: 4,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 22,
    marginBottom: 10,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  pinDotEmpty: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  pinDotFilled: {
    backgroundColor: '#DE8626',
    borderWidth: 2,
    borderColor: '#B45309',
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  messageBox: {
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  hintText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 11.5,
    color: '#DC2626',
    fontWeight: '700',
  },

  // KEYPAD
  keypad: {
    width: '100%',
    maxWidth: 290,
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keyBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E7E1DA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionKeyBtn: {
    backgroundColor: '#FAF7F2',
    borderColor: '#E7E1DA',
  },
  keyBtnDigit: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E2930',
  },
  clearText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#667085',
    letterSpacing: 0.5,
  },

  // FOOTER
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  footerBtnText: {
    fontSize: 11,
    color: '#7C6F62',
    fontWeight: '600',
  },
});
