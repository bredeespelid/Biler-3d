# Biler-3d

3D-bilbibliotek for intern testing: 15 realistiske modeller fra Sketchfab (VW, Audi, Skoda, Cupra, Porsche), klare til bruk i three.js og en Power Platform Code App.

## Bruk i en app (TypeScript)

Kopier `src/cars/` inn i appen og installer three:

```sh
npm install three@0.179.1
```

```ts
import * as THREE from "three";
import { cars } from "./cars";

const scene = new THREE.Scene();
const taycan = await cars.find(c => c.id === "porsche-taycan")!.load();
scene.add(taycan); // 4,6 m lang, hjulene på y = 0, sentrert i origo
```

`cars` er en liste med metadata (merke, modell, karosseri, lisens og forfatter). Hver bil ligger i en egen modul med modellen innebygd som base64, og `load()` henter den med dynamisk import. Med Vite blir derfor hver bil en egen chunk som bare lastes når den vises.

Modulene trenger ingen egne modellfiler og tåler en streng Content Security Policy, som i Code Apps.

## Struktur

| Sti | Innhold |
|---|---|
| `src/cars/loader.ts` | Laster, skalerer og plasserer en bil (`loadCar`) |
| `src/cars/<id>.ts` | Generert: metadata + GLB som base64 |
| `src/cars/index.ts` | Generert: liste over alle bilene |
| `models/*.glb` | Kildefilene, komprimert for web |
| `models/catalog.json` | Hvilke Sketchfab-modeller som brukes, med lisens |
| `models/CREDITS.md` | Kreditering av forfatterne |
| `index.html` | Frittstående viewer (åpne via en lokal server, f.eks. `npx serve .`) |

## Legge til eller bytte en bil

1. Legg modellen inn i `models/catalog.json` (Sketchfab-UID, merke, modell).
2. `SKETCHFAB_API_TOKEN=... node scripts/fetch-models.mjs <id>` laster ned og komprimerer til `models/<id>.glb`.
3. `npm run cars` lager modulene i `src/cars/` på nytt.
4. `npm run typecheck`

## Lisens

Modellene er laget av Sketchfab-brukere og brukes under lisensene i `models/CREDITS.md`. Flere er «NonCommercial» og skal bare brukes internt. Bilmerker og design tilhører produsentene.
