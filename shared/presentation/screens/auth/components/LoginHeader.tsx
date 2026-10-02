import React from 'react';
import { View, Image, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect } from 'react-native-svg';

interface LoginHeaderProps {
  compact?: boolean;
}

export const LoginHeader: React.FC<LoginHeaderProps> = ({ compact = false }) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const minDimension = Math.min(windowWidth, windowHeight);
  const isTablet = minDimension >= 600;
  const isLandscapePhone = windowWidth > windowHeight && !isTablet;
  const isSmallScreen = windowHeight < 700 || windowWidth < 380;

  // Dynamically calculate responsive dimensions for the header & logo
  // Logo aspect ratio from menza_logo_clean.png is 492 × 470 (~0.955)
  const LOGO_ASPECT_RATIO = 470 / 492;

  let logoWidth = Math.min(
    windowWidth * (isLandscapePhone ? 0.25 : isSmallScreen ? 0.48 : isTablet ? 0.32 : 0.54),
    isLandscapePhone ? 120 : compact ? 150 : isSmallScreen ? 180 : isTablet ? 260 : 224
  );

  if (compact && !isLandscapePhone) {
    logoWidth = Math.min(logoWidth, 150);
  }

  const logoHeight = logoWidth * LOGO_ASPECT_RATIO;

  // Header container height adaptively sized so it never pushes inputs down on short screens
  const headerHeight = isLandscapePhone
    ? Math.max(logoHeight + 16, 105)
    : compact
    ? Math.max(logoHeight + 20, 140)
    : isSmallScreen
    ? Math.max(logoHeight + 36, 175)
    : isTablet
    ? Math.max(logoHeight + 60, 240)
    : Math.min(windowHeight * 0.30, Math.max(logoHeight + 48, 215));

  return (
    <View style={[styles.headerContainer, { height: headerHeight }]}>
      {/* 
        1. Ambient Restaurant Background with warm lighting and lamps
        Cleanly covers top width and fades seamlessly into #FAF7F2
      */}
      <Image
        source={require('../../../../../assets/brand/restaurant_header_ambient.png')}
        style={[
          styles.ambientBackdrop,
          {
            height: headerHeight + 30,
            maxWidth: isTablet ? 720 : '100%',
          },
        ]}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />

      {/* 
        2. Vector SVG Radiant Warm Glow Overlay
        Provides glowing warm light under the lamps and cloche
      */}
      <Svg
        width="100%"
        height={headerHeight}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          {/* Left lamp golden flare */}
          <RadialGradient
            id="leftLampGlow"
            cx="14%"
            cy="26%"
            rx="20%"
            ry="25%"
            fx="14%"
            fy="26%"
          >
            <Stop offset="0%" stopColor="#FEA619" stopOpacity="0.28" />
            <Stop offset="60%" stopColor="#DE8626" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#FAF7F2" stopOpacity="0" />
          </RadialGradient>

          {/* Right lamp golden flare */}
          <RadialGradient
            id="rightLampGlow"
            cx="86%"
            cy="26%"
            rx="20%"
            ry="25%"
            fx="86%"
            fy="26%"
          >
            <Stop offset="0%" stopColor="#FEA619" stopOpacity="0.28" />
            <Stop offset="60%" stopColor="#DE8626" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#FAF7F2" stopOpacity="0" />
          </RadialGradient>

          {/* Center warm emblem halo */}
          <RadialGradient
            id="centerEmblemGlow"
            cx="50%"
            cy="52%"
            rx="35%"
            ry="35%"
            fx="50%"
            fy="52%"
          >
            <Stop offset="0%" stopColor="#FFF8EE" stopOpacity="0.75" />
            <Stop offset="65%" stopColor="#FAF7F2" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#FAF7F2" stopOpacity="0" />
          </RadialGradient>

          {/* Seamless bottom fade into background porcelain color */}
          <LinearGradient
            id="bottomAmbientFade"
            x1="0%"
            y1="50%"
            x2="0%"
            y2="100%"
          >
            <Stop offset="0%" stopColor="#FAF7F2" stopOpacity="0" />
            <Stop offset="100%" stopColor="#FAF7F2" stopOpacity="0.95" />
          </LinearGradient>
        </Defs>

        <Rect width="100%" height={headerHeight} fill="url(#centerEmblemGlow)" />
        <Rect width="100%" height={headerHeight} fill="url(#leftLampGlow)" />
        <Rect width="100%" height={headerHeight} fill="url(#rightLampGlow)" />
        <Rect width="100%" height={headerHeight} fill="url(#bottomAmbientFade)" />
      </Svg>

      {/* 
        3. Crisp Menza Logo Emblem:
        Cloche with rising steam, QR code, "menza", arc line, and "ORDER • DINE • DELIGHT"
        Preserves exact aspect ratio and scales smoothly across any device
      */}
      <View style={[styles.logoWrapper, { width: logoWidth, height: logoHeight }]}>
        <Image
          source={require('../../../../../assets/brand/menza_logo_clean.png')}
          style={styles.logoImage}
          resizeMode="contain"
          accessibilityLabel="Menza — Order, Dine, Delight"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  ambientBackdrop: {
    width: '100%',
    position: 'absolute',
    top: 0,
    opacity: 0.95,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
});
