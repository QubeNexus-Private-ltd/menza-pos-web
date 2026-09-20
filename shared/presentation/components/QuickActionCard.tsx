import React, { useRef } from 'react';
import {
  Pressable,
  Animated,
  Text,
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Colors } from '../../core/theme/colors';
import { Typography } from '../../core/theme/typography';
import { Spacing } from '../../core/theme/spacing';
import { GlassCard } from './GlassCard';

export interface QuickActionCardProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  iconBgColor?: string;
  onPress: () => void;
  isLocked?: boolean;
  lockIcon?: React.ReactNode;
  badge?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  description,
  icon,
  iconBgColor = 'rgba(99, 102, 241, 0.15)',
  onPress,
  isLocked = false,
  lockIcon,
  badge,
  style,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
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

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, styles.wrapper]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.pressable}
      >
        <GlassCard style={[styles.card, isLocked && styles.lockedCard, style]}>
          <View style={styles.topHeaderRow}>
            <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
              {icon}
            </View>
            {isLocked && lockIcon}
            {badge}
          </View>

          <Text style={[styles.title, isLocked && styles.lockedText]} numberOfLines={1}>
            {title}
          </Text>

          {!!description && (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          )}
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  pressable: {
    width: '100%',
  },
  card: {
    padding: Spacing.md,
    borderRadius: Spacing.borderRadius.card, // 20px
  },
  lockedCard: {
    opacity: 0.6,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: Spacing.borderRadius.quickAction, // 20px
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.h3, // 17px
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 4,
  },
  lockedText: {
    color: Colors.textMuted,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.body2, // 13px
    lineHeight: 18,
  },
});
