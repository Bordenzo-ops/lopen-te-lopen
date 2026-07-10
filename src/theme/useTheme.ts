// ─────────────────────────────────────────────
// Thema-hook: actieve kleurenset op basis van voorkeur en systeem
// ─────────────────────────────────────────────
//
// Geeft de actieve kleurenset terug (licht of donker) op basis van de
// opgeslagen voorkeur in de store. Bij 'system' volgt de app het systeemthema.
// De teruggegeven objecten zijn module-constanten (darkColors / lightColors),
// dus de referentie is stabiel zolang het thema niet wisselt. Daardoor kan een
// scherm veilig `useMemo(() => makeStyles(colors), [colors])` gebruiken.

import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type ThemeColors } from './tokens';
import { useAppStore } from '../store/appStore';

/** True als het effectieve thema licht is, gegeven de voorkeur en het systeem. */
export function useIsLightTheme(): boolean {
  const preference = useAppStore(s => s.themePreference);
  const systemScheme = useColorScheme();
  if (preference === 'light') return true;
  if (preference === 'dark') return false;
  // 'system': volg het toestel. Zonder bekende waarde vallen we terug op donker.
  return systemScheme === 'light';
}

/** De actieve kleurenset (stabiele referentie per thema). */
export function useThemeColors(): ThemeColors {
  return useIsLightTheme() ? lightColors : darkColors;
}
