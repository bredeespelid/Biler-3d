"""Pakker GLB inn i JSON som base64: {"glb": "..."}.

Brukes bare for artifact-forhåndsvisningen, som ikke kan servere .glb-filer og
blokkerer data:-URL-er i fetch. Vieweren dekoder base64 selv og parser GLB-en.
  python3 scripts/glb-to-json.py models/*.glb  ->  build/models/<id>.json
"""
import base64, json, os, sys

out_dir = os.path.join(os.path.dirname(__file__), "..", "build", "models")
os.makedirs(out_dir, exist_ok=True)
for path in sys.argv[1:]:
    data = open(path, "rb").read()
    assert data[:4] == b"glTF", f"{path} er ikke en GLB"
    name = os.path.splitext(os.path.basename(path))[0] + ".json"
    with open(os.path.join(out_dir, name), "w") as f:
        json.dump({"glb": base64.b64encode(data).decode()}, f)
    print(f"{name}: {os.path.getsize(os.path.join(out_dir, name)) / 1e6:.1f} MB")
