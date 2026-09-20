import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';

export interface VegNonVegBadgeProps {
  isVeg: boolean;
  showText?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export const VegNonVegBadge: React.FC<VegNonVegBadgeProps> = ({
  isVeg,
  showText = true,
  size = 16,
  style,
}) => {
  const color = isVeg ? '#10B981' : '#EF4444';
  const label = isVeg ? 'VEG' : 'NON-VEG';
  const dotSize = Math.round(size * 0.5);

  return (
    <View style={[styles.container, style]}>
      {/* Standard Indian Restaurant Symbol: Square box with dot */}
      <View
        style={[
          styles.outerSquare,
          {
            width: size,
            height: size,
            borderColor: color,
            borderRadius: 3,
          },
        ]}
      >
        <View
          style={[
            styles.innerDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: isVeg ? dotSize / 2 : 1, // Circle for Veg, Triangle/Square for Non-Veg
              backgroundColor: color,
            },
          ]}
        />
      </View>

      {showText && (
        <Text style={[styles.label, { color }]}>{label}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  outerSquare: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  innerDot: {},
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
