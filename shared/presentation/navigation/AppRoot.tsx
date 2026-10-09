import React, { useState, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../state/useAuthStore';
import { SplashScreen } from '../screens/splash/SplashScreen';
import { AppNavigator } from './AppNavigator';
import { appPermissions } from '../../core/permissions/AppPermissionsService';

/**
 * AppRoot manages the application startup and splash screen lifecycle.
 * Session hydration is driven internally by SplashScreen.
 * After splash completion, initial permissions are requested non-blockingly.
 */
export const AppRoot: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const isHydrating = useAuthStore((state) => state.isHydrating);

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
    void appPermissions.requestInitialPermissions();
  }, []);

  // 1. Always display the animated Brand Splash Screen on app launch / reload
  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  // 2. Fallback loader if session hydration is still running
  if (isHydrating) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAF7F2', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#DE8626" />
      </View>
    );
  }

  // 3. Render state-driven root navigator once startup is complete
  return <AppNavigator />;
};
