"""Stream selected daiv05 shards from Hugging Face, resize on the fly, keep only the classes we use.

daiv05/corn-leaf-diseases-pests-and-deficiencies (CC BY-NC-SA 4.0). Shards are sorted by class;
we skip lethal_necrosis (13-16) and nutrient deficiencies, and sample healthy / NLB shards.
"""
import io
import os
import sys
import tarfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from PIL import Image

REPO = "https://huggingface.co/datasets/daiv05/corn-leaf-diseases-pests-and-deficiencies/resolve/main"
# default: a laptop-sized sample; Colab sets UMLIMI_SHARDS to every shard we use (skips 13-16, lethal necrosis)
SHARDS = [int(s) for s in os.environ.get("UMLIMI_SHARDS", "0,1,2,3,4,5,6,7,8,11,17,21,22").split(",")]
KEEP = {"common_rust": "rust", "fall_armyworm": "faw", "gray_leaf_spot": "gls",
        "healthy": "healthy", "northern_corn_leaf_blight": "nlb"}
OUT = Path(__file__).resolve().parent.parent / "data" / "maize"
MAX_SIDE = 320


def fetch(shard: int, tries: int = 4) -> int:
    for attempt in range(tries):
        try:
            return fetch_once(shard)
        except Exception as e:  # dropped connection mid-stream: restart; saved files are skipped
            print(f"shard {shard:02d} attempt {attempt + 1} failed: {e}", flush=True)
    return 0


def fetch_once(shard: int) -> int:
    n = 0
    with requests.get(f"{REPO}/clean-{shard:05d}.tar", stream=True, timeout=60) as r:
        r.raise_for_status()
        r.raw.decode_content = True
        with tarfile.open(fileobj=r.raw, mode="r|") as tar:
            for m in tar:
                if not m.isfile():
                    continue
                parts = m.name.lstrip("./").split("/")
                if len(parts) != 3 or parts[0] not in KEEP:
                    continue
                cls, env, name = parts
                dst = OUT / KEEP[cls] / env / (Path(name).stem + ".jpg")
                if dst.exists():
                    n += 1
                    continue
                raw = tar.extractfile(m).read()  # network errors propagate -> retry the shard
                try:
                    img = Image.open(io.BytesIO(raw)).convert("RGB")
                    img.thumbnail((MAX_SIDE, MAX_SIDE))
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    img.save(dst, quality=88)
                    n += 1
                except Exception as e:  # corrupt image: skip
                    print(f"skip {m.name}: {e}", file=sys.stderr)
    print(f"shard {shard:02d}: {n} images", flush=True)
    return n


if __name__ == "__main__":
    with ThreadPoolExecutor(4) as ex:
        total = sum(ex.map(fetch, SHARDS))
    print("total", total)
