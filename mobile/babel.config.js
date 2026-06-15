module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Fix import.meta for web bundling
      "babel-plugin-transform-import-meta",
    ],
  };
};
