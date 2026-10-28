// Laster ned modellene i models/catalog.json fra Sketchfab og komprimerer dem for web.
//
//   SKETCHFAB_API_TOKEN=... node scripts/fetch-models.mjs [id ...]
//
// Tokenet finner du på https://sketchfab.com/settings/password (API token).
// Uten argumenter hentes alle modeller som ikke allerede ligger i models/.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const MODELS_DIR = join(ROOT, "models");
const MAX_BYTES = 12e6;
const catalog = JSON.parse(readFileSync(join(MODELS_DIR, "catalog.json"), "utf8"));
const token = process.env.SKETCHFAB_API_TOKEN;
if (!token) {
  console.error("Mangler SKETCHFAB_API_TOKEN.");
  process.exit(1);
}

const only = process.argv.slice(2);
const todo = catalog.filter(c => (only.length ? only.includes(c.id) : !existsSync(join(MODELS_DIR, c.file))));

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ved nedlasting`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function findGltf(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { const hit = findGltf(p); if (hit) return hit; }
    else if (name.endsWith(".gltf")) return p;
  }
}

const gltfTransform = (...args) => execFileSync("npx", ["--yes", "@gltf-transform/cli@4.5.1", ...args], { stdio: "inherit" });

for (const car of todo) {
  console.log(`\n${car.brand} ${car.model} (${car.sketchfab.uid})`);
  const res = await fetch(`https://api.sketchfab.com/v3/models/${car.sketchfab.uid}/download`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!res.ok) { console.error(`  hoppet over: ${res.status} ${await res.text()}`); continue; }
  const links = await res.json();
  const work = mkdtempSync(join(tmpdir(), "sf-"));
  try {
    let source;
    if (links.glb) {
      source = join(work, "source.glb");
      await download(links.glb.url, source);
    } else {
      const zip = join(work, "source.zip");
      await download(links.gltf.url, zip);
      execFileSync("unzip", ["-q", zip, "-d", join(work, "src")]);
      source = findGltf(join(work, "src"));
    }
    // quantize krever ingen dekoder i three.js; webp og 2048px holder filene små nok for git.
    // simplify og palette i optimize ødelegger interiør-UV-er på flere modeller, så de er slått av.
    const optimized = join(work, "optimized.glb"), out = join(MODELS_DIR, car.file);
    gltfTransform("optimize", source, optimized, "--simplify", "false", "--palette", "false",
      "--compress", "quantize", "--texture-compress", "webp", "--texture-size", "2048");
    // Etter kvantisering blir mange nesten like punkter helt like.
    gltfTransform("weld", optimized, out);
    // Forenkle bare når filen er for stor for artifact-forhåndsvisningen (16 MB etter base64).
    if (statSync(out).size > MAX_BYTES) {
      gltfTransform("simplify", out, optimized, "--ratio", "0.5", "--error", "0.002");
      gltfTransform("copy", optimized, out);
    }
    const mb = statSync(join(MODELS_DIR, car.file)).size / 1e6;
    console.log(`  lagret ${car.file} (${mb.toFixed(1)} MB)`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
