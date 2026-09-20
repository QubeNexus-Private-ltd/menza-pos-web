import React, { useRef } from 'react';
import {
  Pressable,
  Animated,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Typography } from '../../core/theme/typography';
import { Spacing } from '../../core/theme/spacing';
import { MenzaTokens } from '../../core/theme/menzaTokens';

export type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'standard' | 'small';

export interface TactileButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  gradient?: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fullWidth?: boolean;
}

export const TactileButton: React.FC<TactileButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'standard',
  loading = false,
  disabled = false,
  icon,
  gradient,
  style,
  textStyle,
  fullWidth = true,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      friction: 7,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 7,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'accent':
        return {
          container: {
            backgroundColor: MenzaTokens.colors.brand,
            shadowColor: MenzaTokens.colors.brand,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 18,
            elevation: 6,
          },
          text: { color: '#FFFFFF' },
          useGradient: false,
        };
      case 'outline':
        return {
          container: {
            backgroundColor: MenzaTokens.colors.surface,
            borderWidth: 1,
            borderColor: MenzaTokens.colors.brand,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 2,
          },
          text: { color: MenzaTokens.colors.brandDark },
          useGradient: false,
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: MenzaTokens.colors.surfaceMuted,
            shadowColor: 'transparent',
            elevation: 0,
          },
          text: { color: MenzaTokens.colors.textMuted },
          useGradient: false,
        };
      case 'danger':
        return {
          container: {
            backgroundColor: MenzaTokens.colors.danger,
            shadowColor: MenzaTokens.colors.danger,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 18,
            elevation: 6,
          },
          text: { color: '#FFFFFF' },
          useGradient: false,
        };
      case 'success':
        return {
          container: {
            backgroundColor: MenzaTokens.colors.success,
            shadowColor: MenzaTokens.colors.success,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 18,
            elevation: 6,
          },
          text: { color: '#FFFFFF' },
          useGradient: false,
        };
      case 'primary':
      default:
        return {
          container: {
            backgroundColor: MenzaTokens.colors.brand,
            shadowColor: MenzaTokens.colors.brand,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 18,
            elevation: 6,
          },
          text: { color: '#FFFFFF' },
          useGradient: true,
        };
    }
  };

  const vConfig = getVariantStyles();
  const isSmall = size === 'small';
  const buttonHeight = isSmall ? 38 : 52;
  const borderRadius = isSmall ? 12 : 16;

  const activeGradient = gradient || (variant === 'primary' ? [MenzaTokens.colors.brand, MenzaTokens.colors.brandDark] as const : null);

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }] },
        fullWidth && styles.fullWidth,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.baseContainer,
          {
            height: buttonHeight,
            borderRadius: borderRadius,
          },
          vConfig.container,
          disabled && styles.disabled,
          pressed && styles.pressedState,
          style,
        ]}
      >
        {vConfig.useGradient && activeGradient && !disabled ? (
          <LinearGradient
            colors={activeGradient as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.contentRow,
              { height: buttonHeight, borderRadius: borderRadius },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={vConfig.text.color} size="small" />
            ) : (
              <>
                {icon}
                <Text style={[styles.textStyle, vConfig.text, textStyle]}>{title}</Text>
              </>
            )}
          </LinearGradient>
        ) : (
          <Pressable style={styles.contentRow}>
            {loading ? (
              <ActivityIndicator color={vConfig.text.color} size="small" />
            ) : (
              <>
                {icon}
                <Text style={[styles.textStyle, vConfig.text, textStyle]}>{title}</Text>
              </>
            )}
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
  baseContainer: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentRow: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    gap: 8,
  },
  textStyle: {
    fontSize: Typography.fontSize.button,
    fontWeight: Typography.fontWeight.semiBold,
    letterSpacing: Typography.letterSpacing.button,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  pressedState: {
    opacity: 0.9,
  },
});
