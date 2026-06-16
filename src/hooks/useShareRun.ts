/**
 * useShareRun
 *
 * Hook voor het vastleggen van de ShareRunCard en delen naar Instagram.
 *
 * Flow (Strava-stijl):
 *  1. captureAsync()  — neemt screenshot van de card-ref via expo-view-shot
 *  2. shareToInstagram() — opent Instagram Stories met de afbeelding als sticker
 *  3. shareGeneric()  — valt terug op het native deelmenu als Instagram niet beschikbaar is
 *
 * Vereiste packages (expo):
 *   npx expo install expo-view-shot expo-sharing expo-media-library
 */

import { useRef, useCallback, useState } from 'react';
import { Alert, Platform, Linking, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
// Let op: expo-media-library wordt lazy geladen in saveToLibrary().
// De native module (ExpoMediaLibraryNext) zit niet in Expo Go bij SDK 56;
// een top-level import zou daar de hele app laten crashen.

// ── Instagram URL-scheme ───────────────────────────────────────────────────────
// Instagram Stories accepteert een afbeelding als "background_image" of "sticker_image"
// via de custom URL scheme (identiek aan hoe Strava dit doet).
const INSTAGRAM_STORIES_SCHEME = 'instagram-stories://share';

// Facebook App ID (optioneel — vergroot vertrouwen bij IG)
// Vervang door je eigen app ID als je die hebt:
const FB_APP_ID = ''; // bijv. '123456789012345'

export interface ShareResult {
  success: boolean;
  method?: 'instagram' | 'generic' | 'saved';
  error?: string;
}

export function useShareRun() {
  const cardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  /** Leg de card vast als PNG en geef het bestandspad terug */
  const captureCard = useCallback(async (): Promise<string | null> => {
    if (!cardRef.current) {
      Alert.alert('Fout', 'Kaart is nog niet geladen.');
      return null;
    }
    try {
      const uri = await captureRef(cardRef, {
        format:  'png',
        quality: 1.0,
        // 3× voor hoge resolutie op moderne telefoons
        result:  'tmpfile',
      });
      return uri;
    } catch (err: any) {
      console.error('[useShareRun] captureCard:', err);
      Alert.alert('Fout', 'Kon de kaart niet vastleggen.');
      return null;
    }
  }, []);

  /**
   * Deel direct naar Instagram Stories.
   * Werkt op iOS en Android zolang Instagram geïnstalleerd is.
   * Dezelfde aanpak als Strava: open de IG custom scheme met de image-URI.
   */
  const shareToInstagram = useCallback(async (imageUri: string): Promise<ShareResult> => {
    if (Platform.OS === 'web') {
      return shareGeneric(imageUri);
    }

    const isInstagramAvailable = await Linking.canOpenURL(INSTAGRAM_STORIES_SCHEME);
    if (!isInstagramAvailable) {
      return shareGeneric(imageUri);
    }

    // Bouw de URL op (iOS: data als query-param, Android via native intent)
    const params: Record<string, string> = {
      'background_image': imageUri,
    };
    if (FB_APP_ID) params['source_application'] = FB_APP_ID;

    if (Platform.OS === 'ios') {
      // iOS: open URL-scheme met de afbeelding-URI als parameter
      const queryString = Object.entries(params)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');
      const fullUrl = `${INSTAGRAM_STORIES_SCHEME}?${queryString}`;
      await Linking.openURL(fullUrl);
      return { success: true, method: 'instagram' };
    }

    if (Platform.OS === 'android') {
      // Android: expo-sharing met Instagram als target
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(imageUri, {
          mimeType:    'image/png',
          dialogTitle: 'Deel je run',
          UTI:         'public.png',
        });
        return { success: true, method: 'instagram' };
      }
    }

    return shareGeneric(imageUri);
  }, []);

  /** Valt terug op het native OS-deelmenu */
  const shareGeneric = useCallback(async (imageUri: string): Promise<ShareResult> => {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      // Sla op in fotobibliotheek als laatste optie
      return saveToLibrary(imageUri);
    }
    await Sharing.shareAsync(imageUri, {
      mimeType:    'image/png',
      dialogTitle: 'Deel je run',
      UTI:         'public.png',
    });
    return { success: true, method: 'generic' };
  }, []);

  /** Slaat de kaart op in de fotobibliotheek (vraagt toestemming indien nodig) */
  const saveToLibrary = useCallback(async (imageUri: string): Promise<ShareResult> => {
    let MediaLibrary: typeof import('expo-media-library');
    try {
      MediaLibrary = require('expo-media-library');
    } catch {
      // Native module ontbreekt (bijv. in Expo Go): sla netjes af in plaats van crashen
      Alert.alert(
        'Niet beschikbaar',
        'Opslaan in je fotobibliotheek werkt niet in Expo Go. Gebruik het deelmenu of een development build.',
      );
      return { success: false, error: 'media_library_unavailable' };
    }
    // writeOnly: de app hoeft alleen op te slaan, niet de bibliotheek te lezen
    const { status } = await MediaLibrary.requestPermissionsAsync(true);
    if (status !== 'granted') {
      Alert.alert(
        'Geen toegang',
        'Geef toegang tot je fotobibliotheek om de kaart op te slaan.',
      );
      return { success: false, error: 'permission_denied' };
    }
    await MediaLibrary.saveToLibraryAsync(imageUri);
    Alert.alert('Opgeslagen!', 'Je run-kaart staat in je fotobibliotheek. Open Instagram om te delen.');
    return { success: true, method: 'saved' };
  }, []);

  /**
   * Hoofd-actie: vastleggen + Instagram-share + fallback.
   * Roep dit aan vanuit een knop-handler.
   */
  const share = useCallback(async (): Promise<ShareResult> => {
    setIsSharing(true);
    try {
      const uri = await captureCard();
      if (!uri) return { success: false, error: 'capture_failed' };

      return await shareToInstagram(uri);
    } finally {
      setIsSharing(false);
    }
  }, [captureCard, shareToInstagram]);

  return {
    /** Ref — koppel dit aan de <ShareRunCard ref={...} /> */
    cardRef,
    /** True terwijl de share-actie bezig is */
    isSharing,
    /** Deel de kaart (vastleggen + Instagram of fallback) */
    share,
    /** Alleen vastleggen — handig voor preview */
    captureCard,
    /** Alleen opslaan in fotobibliotheek */
    saveToLibrary,
  };
}
