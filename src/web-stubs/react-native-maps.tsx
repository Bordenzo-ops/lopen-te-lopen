/**
 * Web-stub voor react-native-maps.
 *
 * react-native-maps werkt niet op web (het gebruikt native code die in
 * react-native-web niet bestaat). Deze stub voorkomt dat de webpreview
 * crasht: op web wordt een eenvoudige placeholder getoond. Op Android en
 * iOS wordt via de Metro-config gewoon de echte react-native-maps gebruikt,
 * dus deze stub heeft geen invloed op de productie-app.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const PROVIDER_DEFAULT: unknown = undefined;
export const PROVIDER_GOOGLE: unknown = 'google';

export const Polyline = (_props: Record<string, unknown>): null => null;
export const Marker = (_props: Record<string, unknown>): null => null;

export default function MapView(props: { style?: unknown }): React.ReactElement {
  return (
    <View style={[styles.placeholder, props.style as object]}>
      <Text style={styles.text}>Kaart is niet beschikbaar in de webpreview.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#1a2030',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    borderRadius: 12,
  },
  text: { color: '#9aa3b2', fontSize: 13, textAlign: 'center', padding: 12 },
});
