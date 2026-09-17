const fs = require("node:fs");
const path = require("node:path");

// Sorted bundles keep independently authored catalog batches reproducible.
function loadTaskBatches(seedDirectory) {
  const directory = path.join(seedDirectory, "ycb_batches");
  const merged = { tasks: [], planning: [], claims: [], scenes: [], templates: [] };
  if (!fs.existsSync(directory)) return merged;
  for (const filename of fs.readdirSync(directory).filter((name) => name.endsWith(".json")).sort()) {
    let bundle;
    try {
      bundle = JSON.parse(fs.readFileSync(path.join(directory, filename), "utf8"));
    } catch (error) {
      throw new Error(`${filename}: cannot load task bundle: ${error.message}`);
    }
    for (const key of Object.keys(merged)) {
      if (["scenes", "templates"].includes(key) && bundle[key] === undefined) continue;
      if (!Array.isArray(bundle[key])) throw new Error(`${filename}: ${key} must be an array`);
      merged[key].push(...bundle[key]);
    }
  }
  return merged;
}

module.exports = { loadTaskBatches };
