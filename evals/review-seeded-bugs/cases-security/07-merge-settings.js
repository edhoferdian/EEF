// Merge a team's saved settings JSON over the defaults.
const DEFAULTS = { theme: "light", notifications: { email: true, push: false } };

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function loadSettings(savedJson) {
  return deepMerge(structuredClone(DEFAULTS), JSON.parse(savedJson));
}

module.exports = { loadSettings };
