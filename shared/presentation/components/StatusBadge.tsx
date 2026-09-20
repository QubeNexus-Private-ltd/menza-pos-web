import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Typography } from '../../core/theme/typography';
import { Spacing } from '../../core/theme/spacing';
import { MenzaTokens } from '../../core/theme/menzaTokens';

export type StatusBadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'custom';

export interface StatusBadgeProps {
  label: string;
  variant?: StatusBadgeVariant;
  customBg?: string;
  customColor?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'success',
  customBg,
  customColor,
  icon,
  style,
  textStyle,
}) => {
  const getBadgeConfig = () => {
    switch (variant) {
      case 'success':
        return {
          bg: MenzaTokens.colors.successSoft,
          color: MenzaTokens.colors.success,
        };
      case 'warning':
        return {
          bg: MenzaTokens.colors.warningSoft,
          color: MenzaTokens.colors.warning,
        };
      case 'danger':
        return {
          bg: MenzaTokens.colors.dangerSoft,
          color: MenzaTokens.colors.danger,
        };
      case 'info':
        return {
          bg: MenzaTokens.colors.infoSoft,
          color: MenzaTokens.colors.info,
        };
      case 'custom':
      default:
        return {
          bg: customBg || 'rgba(99, 102, 241, 0.15)',
          color: customColor || '#6366F1',
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <View
      style={[
        styles.badgePill,
        { backgroundColor: config.bg },
        style,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.badgeText,
          { color: config.color },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: Spacing.borderRadius.full, // 999px
    gap: 4,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    letterSpacing: Typography.letterSpacing.badge,
    textTransform: 'uppercase',
  },
});
