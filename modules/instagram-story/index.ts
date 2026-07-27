/**
 * instagram-story (lokale Expo-module)
 *
 * iOS-only brug naar Instagram Stories via het systeem-pasteboard.
 * Op Android en in Expo Go bestaat de native module niet; dan is
 * `isSupported` false en valt de aanroeper terug op het deelmenu.
 */

import { requireOptionalNativeModule } from 'expo-modules-core';

interface InstagramStoryNativeModule {
  isAvailableAsync(): Promise<boolean>;
  shareBackgroundImageAsync(
    fileUri: string,
    appId: string | null,
    topColor: string | null,
    bottomColor: string | null,
  ): Promise<boolean>;
}

// requireOptionalNativeModule geeft null terug i.p.v. te crashen wanneer de
// native module ontbreekt (Android, web, Expo Go, oudere build zonder prebuild).
const nativeModule = requireOptionalNativeModule<InstagramStoryNativeModule>('InstagramStory');

/** True als de native module in deze build zit (alleen iOS). */
export const isSupported = nativeModule != null;

/** True als Instagram geïnstalleerd is en het Stories-scheme geopend mag worden. */
export async function isAvailableAsync(): Promise<boolean> {
  if (!nativeModule) return false;
  return nativeModule.isAvailableAsync();
}

export interface ShareBackgroundOptions {
  /** Facebook App ID voor source_application; leeg = bundle identifier */
  appId?: string;
  /** Hex-kleuren die IG gebruikt om het scherm boven/onder de kaart te vullen */
  topColor?: string;
  bottomColor?: string;
}

/**
 * Zet de PNG als achtergrond op het pasteboard en opent Instagram Stories.
 * Gooit als Instagram ontbreekt of de afbeelding niet leesbaar is.
 */
export async function shareBackgroundImageAsync(
  fileUri: string,
  options: ShareBackgroundOptions = {},
): Promise<boolean> {
  if (!nativeModule) return false;
  return nativeModule.shareBackgroundImageAsync(
    fileUri,
    options.appId ?? null,
    options.topColor ?? null,
    options.bottomColor ?? null,
  );
}
