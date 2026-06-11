import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="goal" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="voice" />
    </Stack>
  );
}
