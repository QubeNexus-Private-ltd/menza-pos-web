import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Path,
} from 'react-native-svg';

interface LoginSvgBackgroundProps {
  width: number;
  height: number;
}

/**
 * Full-screen vector SVG background for Menza Login.
 * Scales perfectly to ANY screen width and height (short, long, phones, tablets).
 */
export const LoginSvgBackground: React.FC<LoginSvgBackgroundProps> = ({
  width,
  height,
}) => {
  const waveHeight = Math.min(180, Math.max(120, height * 0.18));
  const waveTop = height - waveHeight;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Porcelain screen base gradient */}
          <LinearGradient id="bgBaseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FAF7F2" />
            <Stop offset="45%" stopColor="#FFFDFB" />
            <Stop offset="85%" stopColor="#FAF7F2" />
            <Stop offset="100%" stopColor="#F5ECE1" />
          </LinearGradient>

          {/* Top Left Lamp Light Glow */}
          <RadialGradient
            id="lampGlowLeft"
            cx="14%"
            cy="12%"
            rx="22%"
            ry="18%"
            fx="14%"
            fy="12%"
          >
            <Stop offset="0%" stopColor="#FEA619" stopOpacity="0.22" />
            <Stop offset="50%" stopColor="#DE8626" stopOpacity="0.06" />
            <Stop offset="100%" stopColor="#FAF7F2" stopOpacity="0" />
          </RadialGradient>

          {/* Top Right Lamp Light Glow */}
          <RadialGradient
            id="lampGlowRight"
            cx="86%"
            cy="12%"
            rx="22%"
            ry="18%"
            fx="86%"
            fy="12%"
          >
            <Stop offset="0%" stopColor="#FEA619" stopOpacity="0.22" />
            <Stop offset="50%" stopColor="#DE8626" stopOpacity="0.06" />
            <Stop offset="100%" stopColor="#FAF7F2" stopOpacity="0" />
          </RadialGradient>

          {/* Terracotta Bottom Wave Gradient */}
          <LinearGradient id="waveTerracotta" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#DE8626" />
            <Stop offset="48%" stopColor="#E58B24" />
            <Stop offset="100%" stopColor="#CB741B" />
          </LinearGradient>

          {/* Soft Cream Wave Gradient */}
          <LinearGradient id="waveCream" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#F3E7D9" stopOpacity="0.8" />
            <Stop offset="50%" stopColor="#FAF2E8" stopOpacity="0.95" />
            <Stop offset="100%" stopColor="#F3E7D9" stopOpacity="0.8" />
          </LinearGradient>
        </Defs>

        {/* 1. Base Porcelain Background */}
        <Rect width={width} height={height} fill="url(#bgBaseGrad)" />

        {/* 2. Ambient Lamp Glows */}
        <Rect width={width} height={height * 0.4} fill="url(#lampGlowLeft)" />
        <Rect width={width} height={height * 0.4} fill="url(#lampGlowRight)" />
      </Svg>
    </View>
  );
};
