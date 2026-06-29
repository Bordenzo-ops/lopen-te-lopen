// Metro-config voor Lopen te Lopen.
//
// Op web verwijzen we react-native-maps naar een lichte stub, omdat de
// echte module native code gebruikt die in react-native-web niet bestaat
// en de webpreview anders crasht. Op Android en iOS blijft de echte
// react-native-maps gewoon in gebruik; dit raakt de productie-app niet.
const { getDefaultConfig } = require('expo/metro-config');
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

module.exports = config;
