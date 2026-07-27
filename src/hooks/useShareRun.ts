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
import { Alert, Platform, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { trackEvent } from '../services/analyticsService';
import * as InstagramStory from '../../modules/instagram-story';
import { palette } from '../theme/tokens';
// Let op: expo-media-library wordt lazy geladen in saveToLibrary().
// De native module (ExpoMediaLibraryNext) zit niet in Expo Go bij SDK 56;
// een top-level import zou daar de hele app laten crashen.

// ── Instagram Stories ─────────────────────────────────────────────────────────
// De twee platforms delen via compleet verschillende mechanismen:
//
//  iOS     — Instagram leest de afbeelding uit het systeem-pasteboard onder de
//            sleutel com.instagram.sharedSticker.backgroundImage. Query-parameters
//            op instagram-stories://share worden GENEGEERD; een file://-URI is
//            bovendien onbruikbaar voor Instagram vanwege de app-sandbox. Dit
//            loopt daarom via de lokale native module modules/instagram-story.
//  Android — het gewone deelmenu (expo-sharing) met Instagram als target; daar
//            is geen custom scheme voor nodig.
//
// Meta-documentatie: developers.facebook.com/docs/instagram-platform/sharing-to-stories/

// Facebook App ID voor source_application. Optioneel: laat leeg in app.json en de
// native module stuurt de bundle identifier mee.
const FB_APP_ID: string = (Constants.expoConfig?.extra as any)?.instagramAppId ?? '';

// Vulkleuren voor het scherm boven/onder de kaart wanneer het toestel hoger is
// dan 9:16. Gelijk aan de gradient van ShareRunCard/SharePeriodCard, zodat de
// story naadloos oogt in plaats van met witte balken.
const STORY_TOP_COLOR    = palette.neutral[950];
const STORY_BOTTOM_COLOR = palette.neutral[800];

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
    if (Platform.OS === 'ios') {
      // Pasteboard-route via de lokale native module. Ontbreekt die (Expo Go of
      // een build van vóór deze module) of is Instagram niet geïnstalleerd, dan
      // vallen we terug op het deelmenu.
      if (!InstagramStory.isSupported) {
        return shareGeneric(imageUri);
      }
      try {
        const available = await InstagramStory.isAvailableAsync();
        if (!available) {
          return shareGeneric(imageUri);
        }
        const opened = await InstagramStory.shareBackgroundImageAsync(imageUri, {
          appId:       FB_APP_ID,
          topColor:    STORY_TOP_COLOR,
          bottomColor: STORY_BOTTOM_COLOR,
        });
        if (opened) {
          return { success: true, method: 'instagram' };
        }
        return shareGeneric(imageUri);
      } catch (err) {
        console.error('[useShareRun] shareToInstagram(ios):', err);
        return shareGeneric(imageUri);
      }
    }

    if (Platform.OS === 'android') {
      // Android: het systeemdeelmenu heeft Instagram als target — geen custom
      // scheme nodig. Werkt en blijft ongewijzigd.
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
    try {
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
      // LET OP: MediaLibrary.Asset.create() (de "Next"-API) doet op iOS zélf een
      // interne permissiecheck die altijd de VOLLEDIGE (niet write-only) requester
      // gebruikt en eist dat accessPrivileges === 'all' is — zie
      // node_modules/expo-media-library/ios/next/MediaLibraryNextModule.swift
      // regel 296-321 (checkIfPermissionGranted). Vragen we hier alleen write-only/
      // add-only toestemming aan (writeOnly: true), dan is die volledige toestemming
      // nooit verleend en gooit Asset.create() op iOS altijd FailedToGrantPermissions.
      // Android controleert dit niet op deze manier — assetFactory.create() in
      // MediaLibraryNextModule.kt (regel 180) doet geen eigen permissiecheck — dus
      // daar blijft write-only volstaan en behouden we het bestaande gedrag.
      const writeOnly = Platform.OS !== 'ios';
      const { status } = await MediaLibrary.requestPermissionsAsync(writeOnly);
      if (status !== 'granted') {
        Alert.alert(
          'Geen toegang',
          'Geef toegang tot je fotobibliotheek om de kaart op te slaan.',
        );
        return { success: false, error: 'permission_denied' };
      }
      // saveToLibraryAsync is deprecated in expo-media-library 56 en gooit een runtime-error;
      // Asset.create() is de vervangende API voor het opslaan van een bestand in de bibliotheek.
      // Kan alsnog gooien (bv. bij 'beperkte toegang' op iOS, waar accessPrivileges
      // 'limited' i.p.v. 'all' is) — daarom volledig binnen deze try/catch.
      await MediaLibrary.Asset.create(imageUri);
      Alert.alert('Opgeslagen!', 'Je run-kaart staat in je fotobibliotheek. Open Instagram om te delen.');
      return { success: true, method: 'saved' };
    } catch (err: any) {
      // Nooit een onafgehandelde rejection laten ontstaan (zie Sentry ANDROID-5 /
      // FailedToGrantPermissions op iOS) — altijd netjes afvangen en teruggeven.
      console.error('[useShareRun] saveToLibrary:', err);
      Alert.alert(
        'Opslaan mislukt',
        'Kon de kaart niet opslaan in je fotobibliotheek. Probeer het opnieuw of gebruik het deelmenu.',
      );
      return { success: false, error: err?.message ?? 'save_failed' };
    }
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

      const result = await shareToInstagram(uri);
      // Funnel/groei: elke gedeelde run-kaart is gratis reclame. Alleen bij
      // succes en met het gebruikte kanaal (instagram/generic/saved).
      if (result.success) {
        void trackEvent('run_card_shared', { method: result.method ?? 'unknown' });
      }
      return result;
    } catch (err: any) {
      // Laatste vangnet: nooit een onafgehandelde exception naar de UI laten lekken.
      console.error('[useShareRun] share:', err);
      return { success: false, error: err?.message ?? 'unknown_error' };
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
