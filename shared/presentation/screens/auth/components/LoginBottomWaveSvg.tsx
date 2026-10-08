import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  Text,
  Animated,
  Easing,
  Image,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
} from 'react-native-svg';
import { ShieldCheck } from 'lucide-react-native';

interface LoginBottomWaveSvgProps {
  height?: number;
  showBadge?: boolean;
}

export const LoginBottomWaveSvg: React.FC<LoginBottomWaveSvgProps> = ({
  height: propHeight,
  showBadge = true,
}) => {
  const { width: windowWidth, height: windowHeight } =
    useWindowDimensions();

  // Responsive wave height based on screen dimensions and orientation
  const minDimension = Math.min(windowWidth, windowHeight);
  const isTablet = minDimension >= 600;
  const isLandscapePhone = windowWidth > windowHeight && !isTablet;
  const isSmallScreen = windowHeight < 700;
  
  const defaultHeight = isLandscapePhone ? 100 : isSmallScreen ? 140 : isTablet ? 200 : 170;
  const waveHeight = propHeight ?? defaultHeight;

  // Animation
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const waveAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(animation, {
          toValue: 1,
          duration: 4500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),

        Animated.timing(animation, {
          toValue: 0,
          duration: 4500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    waveAnimation.start();

    return () => {
      waveAnimation.stop();
      animation.stopAnimation();
    };
  }, [animation]);

  // Horizontal movement
  const translateX = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [-15, 15],
  });

  // Small vertical movement
  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  return (
    <View
      style={[
        styles.container,
        {
          height: waveHeight,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Animated Wave */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.waveWrapper,
          {
            width: windowWidth * 1.2,
            left: -windowWidth * 0.1,
            transform: [
              {
                translateX,
              },
              {
                translateY,
              },
            ],
          },
        ]}
      >
        <Svg
          width="100%"
          height={waveHeight}
          viewBox="0 0 852 260"
          preserveAspectRatio="none"
        >
          <Defs>
            {/* Cream Gradient */}
            <LinearGradient
              id="creamWaveGrad"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <Stop
                offset="0%"
                stopColor="#F5ECE1"
                stopOpacity="0.85"
              />

              <Stop
                offset="50%"
                stopColor="#F9F1E8"
                stopOpacity="0.95"
              />

              <Stop
                offset="100%"
                stopColor="#F3E7D9"
                stopOpacity="0.85"
              />
            </LinearGradient>

            {/* Terracotta-Gold Gradient */}
            <LinearGradient
              id="terracottaWaveGrad"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <Stop
                offset="0%"
                stopColor="#DE8626"
              />

              <Stop
                offset="45%"
                stopColor="#E58B24"
              />

              <Stop
                offset="75%"
                stopColor="#DE8626"
              />

              <Stop
                offset="100%"
                stopColor="#CB741B"
              />
            </LinearGradient>
          </Defs>

          {/* Upper Cream Wave */}
          <Path
            d="M 0,72 C 240,185 600,185 852,52 L 852,260 L 0,260 Z"
            fill="url(#creamWaveGrad)"
          />

          {/* Lower Terracotta-Gold Wave */}
          <Path
            d="M 0,142 C 260,248 580,248 852,106 L 852,260 L 0,260 Z"
            fill="url(#terracottaWaveGrad)"
          />
        </Svg>
      </Animated.View>

      {/* Brand Trust Badge */}
      {showBadge && (
        <View
          style={styles.badgeWrapper}
          pointerEvents="none"
        >
          {/* Subtle food line art doodle matching NewLogin.png */}
          <Image
            source={require('../../../../../assets/brand/menza-food-line-decor.png')}
            style={[
              styles.foodDecorImage,
              {
                width: Math.min(windowWidth * 0.88, 380),
              },
            ]}
            resizeMode="contain"
            accessibilityElementsHidden
            importantForAccessibility="no"
          />

          <View style={styles.shieldIconRow}>
            <ShieldCheck
              size={isSmallScreen ? 15 : 17}
              color="#DE8626"
              strokeWidth={2.4}
            />
          </View>

          <Text
            style={[
              styles.badgeText,
              isSmallScreen && styles.badgeTextSmall,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            POWERING{' '}
            <Text style={styles.badgeHighlight}>
              1000+
            </Text>{' '}
            RESTAURANTS
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    justifyContent: 'flex-start',
    alignItems: 'center',
    overflow: 'hidden',
  },

  waveWrapper: {
    position: 'absolute',
    top: 0,
    height: '100%',
  },

  badgeWrapper: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    elevation: 2,
  },

  foodDecorImage: {
    height: 26,
    opacity: 0.28,
    tintColor: '#CB741B',
    marginBottom: 4,
  },

  shieldIconRow: {
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  badgeTextSmall: {
    fontSize: 10,
    letterSpacing: 1.1,
  },

  badgeHighlight: {
    color: '#DE8626',
    fontWeight: '800',
  },
});