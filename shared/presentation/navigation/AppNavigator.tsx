import React from 'react';
import { useAuthStore } from '../state/useAuthStore';
import { OnboardingScreen } from '../screens/splash/OnboardingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { PinLockScreen } from '../screens/auth/PinLockScreen';
import { PinSetupScreen } from '../screens/auth/PinSetupScreen';
import { ForgotPinScreen } from '../screens/auth/ForgotPinScreen';
import { AdminDashboardScreen } from '../screens/dashboard/AdminDashboardScreen';

/**
 * AppNavigator handles state-based screen routing decisions:
 * - Fresh install / onboarding incomplete: OnboardingScreen
 * - PIN Setup mode (first-time after OTP): PinSetupScreen
 * - Forgot PIN recovery mode: ForgotPinScreen
 * - Authenticated but in PIN Lock / Store Mode: PinLockScreen
 * - Onboarding complete + not authenticated: PinLockScreen (default) or LoginScreen (optional)
 * - Authenticated & unlocked: AdminDashboardScreen
 */
export const AppNavigator: React.FC = () => {
  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isPinLocked = useAuthStore((state) => state.isPinLocked);
  const authMode = useAuthStore((state) => state.authMode);

  // 1. Show Onboarding carousel on first install / before onboarding is completed
  if (!hasCompletedOnboarding) {
    return <OnboardingScreen />;
  }

  // 2. First-time PIN setup flow
  if (authMode === 'setup_pin') {
    return <PinSetupScreen />;
  }

  // 3. Forgot PIN self-service recovery flow
  if (authMode === 'forgot_pin') {
    return <ForgotPinScreen />;
  }

  // 4. Show PIN Lock screen if authenticated but in PIN locked / Store Mode (DEFAULT)
  if (isAuthenticated && isPinLocked) {
    return <PinLockScreen />;
  }

  // 5. If unauthenticated:
  if (!isAuthenticated) {
    // PIN Login is the DEFAULT view!
    if (authMode === 'pin') {
      return <PinLockScreen />;
    }
    // Mobile + OTP is the optional fallback
    return <LoginScreen />;
  }

  // 6. Authenticated & unlocked: Admin Dashboard (Homescreen)
  return <AdminDashboardScreen />;
};
