import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { radius, spacing, shadows, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'surface' | 'highlighted';
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

export function Card({ children, style, variant = 'default', padding = 'md' }: CardProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View
      style={[
        styles.base,
        styles[variant],
        styles[`padding_${padding}`],
        style,
      ]}
    >
      {children}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  default: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.sm,
  },
  surface: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  highlighted: {
    backgroundColor: colors.bgCard,
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
    ...shadows.md,
  },
  padding_none: { padding: 0 },
  padding_sm: { padding: spacing[1.5] },
  padding_md: { padding: spacing[2] },
  padding_lg: { padding: spacing[3] },
});
