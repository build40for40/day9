// Regenerates trend-index.json from the dataset: node src/intent/build-trend-index.mjs
import { readFile, writeFile } from "node:fs/promises";

const source = new URL("../../../public/fashion.json", import.meta.url);
const target = new URL("./trend-index.json", import.meta.url);

const { trends } = JSON.parse(await readFile(source, "utf8"));
const index = trends
  .map(({ id, name, aliases }) => ({ id, name, aliases }))
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

await writeFile(target, `[\n${index.map((trend) => `  ${JSON.stringify(trend)}`).join(",\n")}\n]\n`);
console.log(`${index.length} trends written to trend-index.json`);
