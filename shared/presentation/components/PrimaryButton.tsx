import React from 'react';
import { StyleProp, ViewStyle, TextStyle } from 'react-native';
import { TactileButton, ButtonVariant, ButtonSize } from './TactileButton';

export interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  gradient?: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fullWidth?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = (props) => {
  return <TactileButton {...props} />;
};
