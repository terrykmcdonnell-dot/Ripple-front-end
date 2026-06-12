const appJson = require('./app.json');

const iosCriticalAlertsEnabled =
  process.env.EXPO_PUBLIC_IOS_CRITICAL_ALERTS_ENABLED === 'true' ||
  process.env.IOS_CRITICAL_ALERTS_ENABLED === 'true';

module.exports = ({ config }) => {
  const expo = appJson.expo;
  const ios = {
    ...expo.ios,
    ...config.ios,
  };

  if (iosCriticalAlertsEnabled) {
    ios.entitlements = {
      ...ios.entitlements,
      'com.apple.developer.usernotifications.critical-alerts': true,
    };
  }

  return {
    ...config,
    ...expo,
    ios,
  };
};
