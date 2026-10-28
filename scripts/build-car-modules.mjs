// Lager én TypeScript-modul per bil i src/cars/ fra models/catalog.json og models/*.glb.
//
//   node scripts/build-car-modules.mjs
//
// Hver modul inneholder metadata og GLB-filen som base64, så appen trenger ingen egne modellfiler.
// src/cars/index.ts lister alle bilene og laster modulene med dynamisk import, slik at hver bil
// blir en egen chunk og bare lastes når den vises.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "src", "cars");
const catalog = JSON.parse(readFileSync(join(ROOT, "models", "catalog.json"), "utf8"));

mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(OUT)) {
  if (name !== "loader.ts") rmSync(join(OUT, name));
}

const metaOf = ({ file, sketchfab: { faces, ...sketchfab }, ...rest }) => ({ ...rest, sketchfab });

for (const car of catalog) {
  const glb = readFileSync(join(ROOT, "models", car.file)).toString("base64");
  writeFileSync(join(OUT, `${car.id}.ts`),
    `// Generert av scripts/build-car-modules.mjs fra models/${car.file}. Ikke rediger for hånd.\n` +
    `// ${car.sketchfab.title} av ${car.sketchfab.author}, ${car.sketchfab.license}: ${car.sketchfab.url}\n` +
    `import type { CarMeta } from "./loader";\n\n` +
    `export const meta: CarMeta = ${JSON.stringify(metaOf(car), null, 2)};\n\n` +
    `export const glb = "${glb}";\n`);
  console.log(`${car.id}.ts (${(glb.length / 1e6).toFixed(1)} MB)`);
}

writeFileSync(join(OUT, "index.ts"),
  `// Generert av scripts/build-car-modules.mjs. Ikke rediger for hånd.\n` +
  `import type * as THREE from "three";\n` +
  `import { loadCar, type CarMeta, type LoadOptions } from "./loader";\n\n` +
  `export type { CarMeta, LoadOptions } from "./loader";\n` +
  `export { loadCar } from "./loader";\n\n` +
  `export interface CarEntry extends CarMeta {\n  /** Henter bilens modul (egen chunk) og bygger en THREE.Group. */\n  load(options?: LoadOptions): Promise<THREE.Group>;\n}\n\n` +
  `export const cars: CarEntry[] = [\n` +
  catalog.map(car => `  { ...${JSON.stringify(metaOf(car))}, load: o => import("./${car.id}").then(m => loadCar(m, o)) },`).join("\n") +
  `\n];\n`);
console.log(`index.ts (${catalog.length} biler)`);
