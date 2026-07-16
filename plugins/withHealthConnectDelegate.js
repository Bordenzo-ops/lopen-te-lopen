/**
 * withHealthConnectDelegate
 *
 * react-native-health-connect v3 vereist dat de app zelf een
 * "permission delegate" registreert bij MainActivity, anders gooit
 * requestPermission() een Kotlin UninitializedPropertyAccessException
 * ("lateinit property requestPermission has not been initialized") en
 * crasht de app zodra de gebruiker Health Connect probeert aan te zetten.
 * De config-plugin die met de package meekomt
 * (node_modules/react-native-health-connect/app.plugin.js) past alleen
 * het AndroidManifest aan (de ACTION_SHOW_PERMISSIONS_RATIONALE
 * intent-filter) en injecteert deze delegate-registratie niet.
 *
 * Deze eigen plugin doet twee dingen bovenop de meegeleverde plugin:
 *
 * 1. In de gegenereerde MainActivity (Kotlin of Java): de import van
 *    HealthConnectPermissionDelegate toevoegen en, na super.onCreate(...),
 *    HealthConnectPermissionDelegate.setPermissionDelegate(this) aanroepen.
 *    Zie: https://matinzd.github.io/react-native-health-connect/docs/setup
 *
 * 2. In het AndroidManifest: een activity-alias met de
 *    android.intent.action.VIEW_PERMISSION_USAGE intent-filter
 *    (categorie HEALTH_PERMISSIONS), zoals de library-docs voorschrijven
 *    voor Android 14+ (waar Health Connect onderdeel is van het
 *    platform). Dit is de opvolger van de oudere
 *    ACTION_SHOW_PERMISSIONS_RATIONALE-intent-filter die de meegeleverde
 *    plugin al toevoegt aan MainActivity zelf; zonder deze alias toont
 *    Health Connect op Android 14+ geen link naar de privacyverklaring
 *    van de app op het permissiescherm. Zie:
 *    https://matinzd.github.io/react-native-health-connect/docs/permissions
 *
 * Beide stappen zijn idempotent: opnieuw prebuilden voegt de regels niet
 * dubbel toe.
 */

const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');

const IMPORT_LINE = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const IMPORT_LINE_JAVA = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate;';
const DELEGATE_CALL_KT = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';
const DELEGATE_CALL_JAVA = 'HealthConnectPermissionDelegate.setPermissionDelegate(this);';

// ── Stap 1: import + delegate-aanroep in MainActivity ─────────────────────
function withHealthConnectMainActivity(config) {
  return withMainActivity(config, config => {
    const isKotlin = config.modResults.language === 'kt';
    let { contents } = config.modResults;

    const importLine = isKotlin ? IMPORT_LINE : IMPORT_LINE_JAVA;
    const delegateCall = isKotlin ? DELEGATE_CALL_KT : DELEGATE_CALL_JAVA;

    // Import direct na de package-declaratie toevoegen, als hij er nog niet is.
    if (!contents.includes(importLine)) {
      contents = contents.replace(
        /^(package [^\n]+\n)/m,
        `$1${importLine}\n`,
      );
    }

    // Delegate-aanroep injecteren direct na super.onCreate(...), als hij er nog niet is.
    if (!contents.includes(delegateCall)) {
      const superOnCreateRegex = /(\n(\s*)super\.onCreate\([^\n]*\);?\n)/;
      const match = contents.match(superOnCreateRegex);
      if (match) {
        const indent = match[2];
        contents = contents.replace(
          superOnCreateRegex,
          `$1${indent}${delegateCall}\n`,
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

// ── Stap 2: activity-alias voor VIEW_PERMISSION_USAGE (Android 14+) ───────
function withHealthConnectViewPermissionUsageAlias(config) {
  return withAndroidManifest(config, config => {
    const androidManifest = config.modResults.manifest;
    const application = androidManifest.application[0];

    application['activity-alias'] = application['activity-alias'] || [];

    const alreadyPresent = application['activity-alias'].some(
      alias => alias.$['android:name'] === '.ViewPermissionUsageActivity',
    );

    if (!alreadyPresent) {
      application['activity-alias'].push({
        $: {
          'android:name': '.ViewPermissionUsageActivity',
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE',
                },
              },
            ],
            category: [
              {
                $: {
                  'android:name': 'android.intent.category.HEALTH_PERMISSIONS',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
}

const withHealthConnectDelegate = config => {
  config = withHealthConnectMainActivity(config);
  config = withHealthConnectViewPermissionUsageAlias(config);
  return config;
};

module.exports = withHealthConnectDelegate;
