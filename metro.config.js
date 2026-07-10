// Metro-config voor Lopen te Lopen.
//
// Op web verwijzen we react-native-maps naar een lichte stub, omdat de
// echte module native code gebruikt die in react-native-web niet bestaat
// en de webpreview anders crasht. Op Android en iOS blijft de echte
// react-native-maps gewoon in gebruik; dit raakt de productie-app niet.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const path = require('path');

// getSentryExpoConfig vervangt hier expo/metro-config's getDefaultConfig:
// het is de door Sentry gedocumenteerde manier om de Metro-config voor Expo
// te bouwen met Sentry's debug-ID-serializer al correct verwerkt. De combinatie
// getDefaultConfig() + withSentryConfig() gaf een build-crash op EAS
// ("Cannot read properties of undefined (reading 'match')" in
// determineDebugIdFromBundleSource, zie github.com/getsentry/sentry-react-native/issues/5315).
const config = getSentryExpoConfig(__dirname);

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return context.resolveRequest(
      context,
      path.resolve(__dirname, 'src/web-stubs/react-native-maps.tsx'),
      platform,
    );
  }
  return originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

// getSentryExpoConfig regelt de debug-ID's/source maps al (zie docs/SENTRY_SETUP.md),
// dus geen extra withSentryConfig-wrap meer nodig (dat veroorzaakte de crash hierboven).
module.exports = config;
