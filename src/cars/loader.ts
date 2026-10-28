import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface CarMeta {
  id: string;
  brand: string;
  model: string;
  body: string;
  commercialUse: boolean;
  sketchfab: {
    uid: string;
    title: string;
    url: string;
    author: string;
    authorUrl: string;
    license: string;
    licenseUrl: string;
  };
  /** Per-model corrections: wrong up-axis, untextured clay models, materials exported as BLEND. */
  fix?: { rotate?: [number, number, number]; paint?: string; recomputeNormals?: boolean; forceOpaque?: boolean };
}

/** A generated car module: metadata plus the GLB file as base64. */
export interface CarModule {
  meta: CarMeta;
  glb: string;
}

export interface LoadOptions {
  /** Longest horizontal side in metres after scaling. Default 4.6. */
  length?: number;
  castShadow?: boolean;
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

const loader = new GLTFLoader();
// Load embedded textures through <img> instead of fetch(blob:), which strict CSPs (Code Apps, artifacts) can block.
loader.register(parser => {
  parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
  return { name: "img_textures" };
});

function applyFix(root: THREE.Object3D, fix: CarMeta["fix"] = {}) {
  if (fix.rotate) root.rotation.set(...(fix.rotate.map(THREE.MathUtils.degToRad) as [number, number, number]));
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (fix.recomputeNormals) { mesh.geometry.deleteAttribute("normal"); mesh.geometry.computeVertexNormals(); }
    if (fix.paint) mesh.material = new THREE.MeshPhysicalMaterial({ color: fix.paint, metalness: 0.5, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.1 });
    if (fix.forceOpaque) {
      for (const m of ([] as THREE.Material[]).concat(mesh.material)) {
        Object.assign(m, { transmission: 0, transparent: false, depthWrite: true });
        m.needsUpdate = true;
      }
    }
  });
  root.updateMatrixWorld(true);
}

/** Scale to a common length, put the wheels on y = 0 and centre the car on the origin. */
function fit(root: THREE.Object3D, length: number): THREE.Group {
  // precise = true: quantized meshes report a loose bounding box otherwise, which makes cars float.
  const size = new THREE.Box3().setFromObject(root, true).getSize(new THREE.Vector3());
  root.scale.multiplyScalar(length / Math.max(size.x, size.z));
  const box = new THREE.Box3().setFromObject(root, true);
  const c = box.getCenter(new THREE.Vector3());
  root.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  const group = new THREE.Group();
  group.add(root);
  return group;
}

/** Parse a generated car module into a ready-to-add THREE.Group. */
export async function loadCar(mod: CarModule, { length = 4.6, castShadow = true }: LoadOptions = {}): Promise<THREE.Group> {
  const gltf = await loader.parseAsync(base64ToBuffer(mod.glb), "");
  applyFix(gltf.scene, mod.meta.fix);
  if (castShadow) gltf.scene.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const group = fit(gltf.scene, length);
  group.name = mod.meta.id;
  group.userData.meta = mod.meta;
  return group;
}
