/** @type {import('detox').DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath:
        '/Users/graceturner/Library/Developer/Xcode/DerivedData/Suppr-ghqeqxquekvtgkbebzlhdorlyumf/Build/Products/Debug-iphonesimulator/Suppr.app',
      build:
        'SENTRY_DISABLE_AUTO_UPLOAD=true npx expo run:ios --no-install --no-bundler --configuration Debug',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath:
        '/Users/graceturner/Library/Developer/Xcode/DerivedData/Suppr-ghqeqxquekvtgkbebzlhdorlyumf/Build/Products/Release-iphonesimulator/Suppr.app',
      build:
        'SENTRY_DISABLE_AUTO_UPLOAD=true npx expo run:ios --no-install --no-bundler --configuration Release',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 16 Pro',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
  },
};
