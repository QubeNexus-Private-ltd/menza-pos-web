import React from 'react';
import { useAuthStore } from '../state/useAuthStore';
import { OnboardingScreen } from '../screens/splash/OnboardingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { AdminDashboardScreen } from '../screens/dashboard/AdminDashboardScreen';

/**
 * AppNavigator handles state-based screen routing decisions:
 * - Fresh install / onboarding incomplete: OnboardingScreen
 * - Onboarding complete + not authenticated: LoginScreen
 * - Authenticated: AdminDashboardScreen
 */
export const AppNavigator: React.FC = () => {
  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // 1. Show Onboarding carousel on first install / before onboarding is completed
  if (!hasCompletedOnboarding) {
    return <OnboardingScreen />;
  }

  // 2. Show Login screen if user has not authenticated yet
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // 3. Authenticated Admin Dashboard (Homescreen)
  return <AdminDashboardScreen />;
};
