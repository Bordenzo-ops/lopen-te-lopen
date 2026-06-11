import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { colors, typography, spacing, radius, shadows } from '../../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.textInverse : colors.brandPrimary}
          size="small"
        />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text style={[styles.label, styles[`label_${variant}`], styles[`labelSize_${size}`]]}>
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...shadows.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  icon: {
    marginRight: 2,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },

  // Variants
  primary: {
    backgroundColor: colors.brandPrimary,
  },
  secondary: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  destructive: {
    backgroundColor: colors.error,
  },

  // Sizes
  size_sm: {
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[0.5] + 2,
    minHeight: 44,
  },
  size_md: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    minHeight: 48,
  },
  size_lg: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    minHeight: 56,
  },

  // Labels
  label: {
    fontFamily: typography.fontFamily.sansSemi,
    letterSpacing: typography.letterSpacing.wide,
  },
  label_primary: { color: colors.textInverse },
  label_secondary: { color: colors.textPrimary },
  label_ghost: { color: colors.brandPrimary },
  label_destructive: { color: '#fff' },

  labelSize_sm: { fontSize: typography.fontSize.sm },
  labelSize_md: { fontSize: typography.fontSize.base },
  labelSize_lg: { fontSize: typography.fontSize.md },
});
