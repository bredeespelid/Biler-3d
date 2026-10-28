"""Pakker GLB om til glTF-JSON med innebygd buffer (data-URI).

Brukes bare for artifact-forhåndsvisningen, som ikke kan servere .glb-filer.
  python3 scripts/glb-to-json.py models/*.glb  ->  build/models/<id>.json
"""
import base64, json, os, struct, sys

out_dir = os.path.join(os.path.dirname(__file__), "..", "build", "models")
os.makedirs(out_dir, exist_ok=True)
for path in sys.argv[1:]:
    data = open(path, "rb").read()
    magic, _, length = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, f"{path} er ikke en GLB"
    offset, doc, binary = 12, None, b""
    while offset < length:
        size, kind = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8: offset + 8 + size]
        if kind == 0x4E4F534A: doc = json.loads(chunk)
        elif kind == 0x004E4942: binary = chunk
        offset += 8 + size
    if doc.get("buffers"):
        doc["buffers"][0]["uri"] = "data:application/octet-stream;base64," + base64.b64encode(binary).decode()
    name = os.path.splitext(os.path.basename(path))[0] + ".json"
    with open(os.path.join(out_dir, name), "w") as f: json.dump(doc, f, separators=(",", ":"))
    print(f"{name}: {os.path.getsize(os.path.join(out_dir, name)) / 1e6:.1f} MB")
