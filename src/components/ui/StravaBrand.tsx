/**
 * StravaBrand
 *
 * De officiele Strava-merkelementen, op een plek bij elkaar. Alles hier volgt
 * de Strava Brand Guidelines (https://developers.strava.com/guidelines/); pas
 * dit bestand dus niet aan zonder die pagina ernaast te leggen.
 *
 * Harde regels die hier worden afgedwongen:
 *  - De "Connect with Strava"-knop is een ONGEWIJZIGDE asset uit hun eigen
 *    downloadpakket (assets/strava/). Zelf natekenen, hertypografieren,
 *    verkleuren of animeren is expliciet verboden. Daarom een <Image>, geen
 *    View met eigen tekst.
 *  - De knop houdt zijn originele hoogte van 48px en zijn aspect ratio.
 *  - Het "Compatible with Strava"-logo mag nooit prominenter zijn dan het
 *    merk van de app zelf: het staat daarom klein en onderaan de kaart.
 *  - Wij gebruiken "Compatible with", niet "Powered by": de app stuurt runs
 *    NAAR Strava en toont zelf geen Strava-data. "Powered by" zou suggereren
 *    dat onze functies op Strava-data draaien, en dat is niet zo.
 *
 * Zie docs/STRAVA_COMPLIANCE.md voor het volledige dossier.
 */

import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { spacing } from '../../theme/tokens';
import { useIsLightTheme } from '../../theme/useTheme';

/** Originele afmetingen van de assets, gebruikt om de aspect ratio te bewaren. */
const CONNECT_BUTTON = { width: 237, height: 48 };
const COMPAT_LOGO    = { width: 437, height: 37 };

/** Hoogte waarop we het "Compatible with Strava"-logo tonen (klein en secundair). */
const COMPAT_LOGO_HEIGHT = 16;

interface StravaConnectButtonProps {
  onPress: () => void;
  /** Blokkeert de knop terwijl de OAuth-flow al loopt. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * De officiele "Connect with Strava"-knop. De tekst op de knop is Engels en
 * blijft Engels: het is onderdeel van de afbeelding en mag niet vertaald
 * worden. De Nederlandse uitleg staat in de regel erboven.
 */
export function StravaConnectButton({ onPress, disabled = false, style }: StravaConnectButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      // Het label beschrijft de knop voor schermlezers; de afbeelding zelf
      // blijft onaangetast.
      accessibilityLabel="Verbind met Strava"
      accessibilityState={{ disabled }}
      style={[styles.connectWrap, disabled && styles.connectDisabled, style]}
    >
      <Image
        source={require('../../../assets/strava/btn_strava_connect_with_orange.png')}
        style={styles.connectImage}
        resizeMode="contain"
        accessible={false}
      />
    </TouchableOpacity>
  );
}

/**
 * Het "Compatible with Strava"-logo, in de variant die past bij het actieve
 * thema (oranje op licht, wit op donker). Beide varianten komen ongewijzigd
 * uit het officiele pakket.
 */
export function StravaCompatibleLogo({ style }: { style?: StyleProp<ViewStyle> }) {
  const isLight = useIsLightTheme();

  return (
    <View style={[styles.compatWrap, style]}>
      <Image
        source={
          isLight
            ? require('../../../assets/strava/api_logo_cptblWith_strava_horiz_orange.png')
            : require('../../../assets/strava/api_logo_cptblWith_strava_horiz_white.png')
        }
        style={styles.compatImage}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Compatible with Strava"
      />
    </View>
  );
}

// Geen themakleuren nodig: de assets brengen hun eigen kleur mee en mogen niet
// overschilderd worden. De donker/licht-keuze zit in de assetkeuze hierboven.
const styles = StyleSheet.create({
  connectWrap: {
    alignSelf: 'flex-start',
  },
  connectDisabled: {
    opacity: 0.5,
  },
  connectImage: {
    width:  CONNECT_BUTTON.width,
    height: CONNECT_BUTTON.height,
  },
  compatWrap: {
    alignItems: 'flex-start',
    paddingVertical: spacing[1],
  },
  compatImage: {
    height: COMPAT_LOGO_HEIGHT,
    width:  COMPAT_LOGO_HEIGHT * (COMPAT_LOGO.width / COMPAT_LOGO.height),
  },
});
