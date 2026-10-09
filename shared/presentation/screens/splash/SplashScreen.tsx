import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { logger } from '../../../core/logging';
import { useAuthStore } from '../../state/useAuthStore';
import { AuthRemoteDataSource } from '../../../data/datasources/AuthRemoteDataSource';
import { usePrinterStore } from '../../state/usePrinterStore';

interface SplashScreenProps {
  onFinish?: () => void;
  minDisplayDurationMs?: number;
}


const SAFE_MAX_TIMEOUT_MS = 4200;
const MIN_DISPLAY_DURATION_MS = 1800;

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  minDisplayDurationMs = MIN_DISPLAY_DURATION_MS,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [statusText, setStatusText] = useState('Loading your restaurant...');
  const [progressPercent, setProgressPercent] = useState(0);

  // Animation values
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const textFadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Track completion state
  const isFinishedRef = useRef(false);
  const currentProgressRef = useRef(0);

  // Full-bleed responsive canvas dimensions adapting dynamically to all screen aspect ratios
  const canvasWidth = windowWidth;
  const canvasHeight = windowHeight;

  // Smoothly update progress percentage
  const animateProgressTo = useCallback(
    (toValue: number, duration: number = 350): Promise<void> => {
      return new Promise((resolve) => {
        Animated.timing(progressAnim, {
          toValue,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start(() => {
          currentProgressRef.current = toValue;
          resolve();
        });
      });
    },
    [progressAnim]
  );

  // Smooth text change with cross-fade
  const updateStatus = useCallback(
    (newText: string) => {
      Animated.timing(textFadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start(() => {
        setStatusText(newText);
        Animated.timing(textFadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    },
    [textFadeAnim]
  );

  // Safe finish handler to guarantee the user is never stuck
  const completeSplash = useCallback(() => {
    if (isFinishedRef.current) return;
    isFinishedRef.current = true;

    // Smooth exit fade
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 250,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      onFinish?.();
    });
  }, [onFinish, opacityAnim]);

  useEffect(() => {
    logger.navigation('SplashScreen');

    // Hide Expo's static native splash screen
    ExpoSplashScreen.hideAsync().catch(() => undefined);

    // Initial fade in of the entire splash canvas
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();

    // Subtle gentle pulse animation for dynamic glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Track live progress percentage for accessibility and readouts
    const listenerId = progressAnim.addListener(({ value }) => {
      setProgressPercent(Math.min(100, Math.round(value * 100)));
    });

    const startTime = Date.now();

    // Safety fallback timeout to prevent hanging under any circumstances
    const fallbackTimer = setTimeout(() => {
      if (!isFinishedRef.current) {
        logger.warn('SYSTEM', 'TIMEOUT_TRIGGERED', 'Splash fallback timeout triggered');
        animateProgressTo(1.0, 200).then(() => completeSplash());
      }
    }, SAFE_MAX_TIMEOUT_MS);

    // Real asynchronous bootstrapping workflow
    const runInitialization = async () => {
      try {
        // Stage 1: Initialize Menza System & storage
        updateStatus('Initializing Menza...');
        await animateProgressTo(0.20, 350);

        // Stage 2: Hydrate session and credentials from secure storage
        updateStatus('Checking session & security...');
        const isAuth = await useAuthStore.getState().hydrateSession();
        await animateProgressTo(0.48, 380);

        // Stage 3: Real Restaurant Data Loading
        if (isAuth) {
          const authState = useAuthStore.getState();
          const activeRest = authState.activeRestaurant;
          const restaurantName = activeRest?.restaurantName;

          if (restaurantName) {
            updateStatus(`Loading ${restaurantName}...`);
          } else {
            updateStatus('Loading your restaurant...');
          }

          await animateProgressTo(0.72, 380);

          // Asynchronously sync restaurant outlets & preheat printer settings
          try {
            const authDs = new AuthRemoteDataSource();
            const restaurants = await authDs.getMyRestaurants();
            if (restaurants && restaurants.length > 0) {
              useAuthStore.getState().setRestaurants(restaurants);
            }
                    } catch (syncErr: any) {
            // If the user's authentication was rejected or invalidated
            if (!useAuthStore.getState().isAuthenticated || syncErr?.response?.status === 401) {
              logger.warn('AUTH', 'SESSION_EXPIRED_DURING_SPLASH', 'User session expired during startup sync');
              useAuthStore.getState().logout();
              updateStatus('Please sign in to continue...');
              await animateProgressTo(1.0, 200);
              completeSplash();
              return;
            }
            logger.warn('AUTH', 'REST_SYNC_CACHED', 'Using cached restaurant info', {
              error: String(syncErr),
            });
          }

          // Stage 4: Sync operational settings & printer modules
          updateStatus('Syncing operational settings...');
          await Promise.allSettled([
            usePrinterStore.getState().init(),
            animateProgressTo(0.92, 320),
          ]);
        } else {
          // Unauthenticated / First Install
          updateStatus('Preparing your workspace...');
          await animateProgressTo(0.85, 350);
        }

        // Stage 5: Ready state
        updateStatus('Ready! Welcome to Menza');
        await animateProgressTo(1.0, 220);

        // Ensure minimum smooth display duration for silky UX
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, minDisplayDurationMs - elapsed);
        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
        }

        // Complete and transition smoothly
        completeSplash();
      } catch (error) {
        logger.error('SYSTEM', 'INITIALIZATION_FAILED', error);
        // Resilient fallback: smooth glide to 100% and finish
        updateStatus('Starting Menza...');
        await animateProgressTo(1.0, 200);
        completeSplash();
      } finally {
        clearTimeout(fallbackTimer);
      }
    };

    runInitialization();

    return () => {
      progressAnim.removeListener(listenerId);
      clearTimeout(fallbackTimer);
    };
  }, [
    animateProgressTo,
    completeSplash,
    minDisplayDurationMs,
    opacityAnim,
    progressAnim,
    pulseAnim,
    updateStatus,
  ]);

  // Geometric position matching loading bar coordinates (above safe-area bottom)
  const barTop = Math.min(canvasHeight * 0.855, canvasHeight - Math.max(insets.bottom, 16) - 65);
  const barWidth = Math.min(canvasWidth * 0.55, 320);
  const barHeight = Math.max(7, Math.min(9, canvasHeight * 0.0055));

  const progressFillWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, barWidth],
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" translucent />

      {/* Main Full-Bleed Canvas Container */}
      <Animated.View
        style={[
          styles.canvasContainer,
          {
            width: canvasWidth,
            height: canvasHeight,
            opacity: opacityAnim,
          },
        ]}
      >
        {/* Full-bleed visual reference artwork */}
        <Image
          accessibilityLabel="Menza — Order, Dine, Delight"
          source={require('../../../../assets/menza_splash_clean.png')}
          style={styles.fullImage}
          resizeMode="cover"
        />

        {/* Real Dynamic Loading Container positioned over the loading region */}
        <SafeAreaView style={styles.safeOverlay} edges={['left', 'right']}>
          <View
            style={[
              styles.loadingSection,
              {
                top: barTop,
                width: canvasWidth,
              },
            ]}
          >
            {/* Real Animated Capsule Progress Bar */}
            <View
              style={[
                styles.capsuleTrack,
                {
                  width: barWidth,
                  height: barHeight,
                  borderRadius: barHeight / 2,
                },
              ]}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: progressPercent }}
            >
              <Animated.View
                style={[
                  styles.capsuleFillContainer,
                  {
                    width: progressFillWidth,
                    borderRadius: barHeight / 2,
                  },
                ]}
              >
                <LinearGradient
                  colors={['#F59E0B', '#E58B24', '#DE8626', '#CB741B']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.gradientFill}
                />
                {/* Glowing flare tip at the leading edge */}
                <Animated.View
                  style={[
                    styles.flareTip,
                    {
                      height: barHeight,
                      borderRadius: barHeight / 2,
                    },
                  ]}
                />
              </Animated.View>
            </View>

            {/* Dynamic Status Text with live messages and smooth transitions */}
            <Animated.Text
              style={[
                styles.statusText,
                {
                  opacity: textFadeAnim,
                  fontSize: Math.max(11, Math.min(13.5, canvasWidth * 0.034)),
                },
              ]}
              numberOfLines={1}
            >
              {statusText}
            </Animated.Text>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasContainer: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#FAF7F2',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  safeOverlay: {
    ...StyleSheet.absoluteFill,
  },
  loadingSection: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  capsuleTrack: {
    backgroundColor: '#F8EFE4',
    borderWidth: 1,
    borderColor: '#DE8626',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    shadowColor: '#DE8626',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  capsuleFillContainer: {
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  gradientFill: {
    flex: 1,
  },
  flareTip: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  statusText: {
    color: '#5C4E3D',
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 8,
    textAlign: 'center',
  },
});
