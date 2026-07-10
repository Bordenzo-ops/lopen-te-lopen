// Metro-config voor Lopen te Lopen.
//
// Op web verwijzen we react-native-maps naar een lichte stub, omdat de
// echte module native code gebruikt die in react-native-web niet bestaat
// en de webpreview anders crasht. Op Android en iOS blijft de echte
// react-native-maps gewoon in gebruik; dit raakt de productie-app niet.
const { getDefaultConfig } = require('expo/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

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

// Voegt debug-ID's toe aan bundel en source maps zodat Sentry
// crashstacktraces kan koppelen aan leesbare bestandsnamen/regelnummers
// in plaats van geminificeerde code. Zie docs/SENTRY_SETUP.md.
module.exports = withSentryConfig(config);
