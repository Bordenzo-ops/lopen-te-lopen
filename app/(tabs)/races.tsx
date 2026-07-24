import React, { useMemo } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { type ThemeColors } from '../../src/theme/tokens';
import { useThemeColors } from '../../src/theme/useTheme';
import { useAppStore } from '../../src/store/appStore';
import { useMaybeShowPremiumIntro } from '../../src/hooks/usePremiumIntro';
import { RacePickerScreen } from '../../src/components/ui/RacePickerScreen';
import type { RacePlan } from '../../src/data/buildRacePlan';

export default function RacesTab() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const setRacePlan          = useAppStore(s => s.setRacePlan);
  const setSchemaMode        = useAppStore(s => s.setSchemaMode);
  const updateProfile        = useAppStore(s => s.updateProfile);
  const setRaceTargetSeconds = useAppStore(s => s.setRaceTargetSeconds);
  const maybeShowIntro       = useMaybeShowPremiumIntro();

  function handleSelectRace(plan: RacePlan, targetSeconds: number | null) {
    // setRacePlan reset eerst de doeltijd; daarna zetten we de nieuwe (premium).
    setRacePlan(plan);
    setRaceTargetSeconds(targetSeconds);
    setSchemaMode('race');
    // Sync profile.goal zodat het vrije trainingsschema ook klopt als de
    // gebruiker later terugschakelt naar trainingsmodus
    updateProfile({ goal: plan.goal });
    // Wedstrijddoel-trigger voor het premium value-scherm: best-effort, met
    // korte vertraging zodat de keuze eerst zichtbaar verwerkt wordt.
    setTimeout(maybeShowIntro, 400);
  }

  return (
    <SafeAreaView style={styles.container}>
      <RacePickerScreen onSelectRace={handleSelectRace} />
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
});
