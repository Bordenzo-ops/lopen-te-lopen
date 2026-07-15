import { Tabs } from 'expo-router';
import { spacing, typography } from '../../src/theme/tokens';
import { useThemeColors } from '../../src/theme/useTheme';
import { Home, Calendar, CalendarDays, Settings, Trophy } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60 + insets.bottom;
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgSurface,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: 1,
          paddingBottom: insets.bottom + spacing[1],
          paddingTop: spacing[0.5],
          height: tabBarHeight,
        },
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontFamily: typography.fontFamily.sansMedium,
          fontSize: typography.fontSize.xs,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size - 2} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schema',
          tabBarIcon: ({ color, size }) => (
            <Calendar color={color} size={size - 2} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="logbook"
        options={{
          title: 'Logboek',
          tabBarIcon: ({ color, size }) => (
            <CalendarDays color={color} size={size - 2} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="races"
        options={{
          title: 'Wedstrijd',
          tabBarIcon: ({ color, size }) => (
            <Trophy color={color} size={size - 2} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Instellingen',
          tabBarIcon: ({ color, size }) => (
            <Settings color={color} size={size - 2} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}
