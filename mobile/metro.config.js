const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /.*@react-native\/debugger-frontend.*/,
  /.*@react-native\/debugger-shell.*/,
  /.*@react-native\/community-cli-plugin.*/,
  /.*hosted-git-info.*/,
  /.*\/glob\/dist\/.*/,
  /.*\/lru-cache\/dist\/esm\/.*/,
  /.*\/lru-cache\/dist\/commonjs\/.*/,
];

module.exports = config;
