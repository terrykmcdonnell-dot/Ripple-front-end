const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MARKER = '# Ripple: AppCheckCore Swift dependencies require modular headers';
const PODS = ['GoogleUtilities', 'RecaptchaInterop'];

function withIosGoogleModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return cfg;
      }

      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(MARKER)) {
        return cfg;
      }

      const lines = contents.split(/\r?\n/);
      const insertIndex = lines.findIndex((line) => line.includes('use_expo_modules!'));
      if (insertIndex === -1) {
        return cfg;
      }

      const indent = lines[insertIndex].match(/^\s*/)?.[0] ?? '  ';
      const block = [
        `${indent}${MARKER}`,
        ...PODS.map((pod) => `${indent}pod '${pod}', :modular_headers => true`),
      ];

      lines.splice(insertIndex + 1, 0, ...block);
      contents = lines.join('\n');
      fs.writeFileSync(podfilePath, contents, 'utf8');
      return cfg;
    },
  ]);
}

module.exports = withIosGoogleModularHeaders;
