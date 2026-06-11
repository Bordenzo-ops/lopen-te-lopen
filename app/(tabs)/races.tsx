import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { colors } from '../../src/theme/tokens';
import { useAppStore } from '../../src/store/appStore';
import { RacePickerScreen } from '../../src/components/ui/RacePickerScreen';
import type { RacePlan } from '../../src/data/buildRacePlan';

export default function RacesTab() {
  const setRacePlan    = useAppStore(s => s.setRacePlan);
  const setSchemaMode  = useAppStore(s => s.setSchemaMode);
  const updateProfile  = useAppStore(s => s.updateProfile);

  function handleSelectRace(plan: RacePlan) {
    setRacePlan(plan);
    setSchemaMode('race');
    // Sync profile.goal zodat het vrije trainingsschema ook klopt als de
    // gebruiker later terugschakelt naar trainingsmodus
    updateProfile({ goal: plan.goal });
  }

  return (
    <SafeAreaView style={styles.container}>
      <RacePickerScreen onSelectRace={handleSelectRace} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
});
