import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Colors } from '../../core/theme/colors';
import { Typography } from '../../core/theme/typography';
import { Spacing } from '../../core/theme/spacing';

export interface TabItem {
  key: string;
  label: string;
  icon: (color: string, size: number) => React.ReactNode;
  badge?: number | string;
}

export interface FloatingNavBarProps {
  tabs: TabItem[];
  activeTabKey: string;
  onSelectTab: (tabKey: string) => void;
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const FloatingNavBar: React.FC<FloatingNavBarProps> = ({
  tabs,
  activeTabKey,
  onSelectTab,
  visible = true,
  style,
}) => {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : 120, // Slide down off-screen when hidden
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Animated.View
      style={[
        styles.floatingContainer,
        { transform: [{ translateY }] },
        style,
      ]}
    >
      <View style={styles.glassPill}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeTabKey;
          const activeColor = Colors.primary;
          const inactiveColor = Colors.textMuted;

          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.8}
              onPress={() => onSelectTab(tab.key)}
              style={[
                styles.tabItem,
                isActive && styles.activeTabPill,
              ]}
            >
              {tab.icon(isActive ? activeColor : inactiveColor, 20)}
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? activeColor : inactiveColor },
                  isActive && styles.activeTabLabel,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    zIndex: 999,
    alignItems: 'center',
  },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: Colors.glassOverlay,
    borderRadius: Spacing.borderRadius.floatingNav, // 36px
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  activeTabPill: {
    backgroundColor: Colors.dark.activeTabBg, // subtle tinted pill background
  },
  tabLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  activeTabLabel: {
    fontWeight: Typography.fontWeight.bold,
  },
});
