"""'other' class (not a maize leaf) + an independent field test set.

- Imagenette (fast.ai, Apache-2.0): everyday objects -> "this is not a maize leaf" examples.
- PlantDoc (CC BY 4.0, web/field photos): non-corn leaves -> 'other'; corn classes -> external field test set.
"""
import io
import random
import tarfile
import zipfile
from pathlib import Path

import requests
from PIL import Image

DATA = Path(__file__).resolve().parent.parent / "data"
MAX_SIDE = 320
random.seed(0)


def save(img_bytes: bytes, dst: Path):
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, quality=88)


def imagenette(n=900):
    r = requests.get("https://s3.amazonaws.com/fast-ai-imageclas/imagenette2-160.tgz", timeout=120)
    with tarfile.open(fileobj=io.BytesIO(r.content), mode="r:gz") as tar:
        members = [m for m in tar.getmembers() if m.isfile() and m.name.endswith(".JPEG")]
        for m in random.sample(members, n):
            save(tar.extractfile(m).read(), DATA / "maize" / "other" / "imagenette" / Path(m.name).name)
    print("imagenette", n)


PLANTDOC_CORN = {"Corn Gray leaf spot": "gls", "Corn leaf blight": "nlb", "Corn rust leaf": "rust"}


def plantdoc(n_other=900):
    r = requests.get("https://github.com/pratikkayal/PlantDoc-Dataset/archive/refs/heads/master.zip", timeout=300)
    z = zipfile.ZipFile(io.BytesIO(r.content))
    others, corn = [], 0
    for name in z.namelist():
        p = Path(name)
        if p.suffix.lower() not in {".jpg", ".jpeg", ".png"} or len(p.parts) < 4:
            continue
        cls = p.parts[-2]
        try:
            if cls in PLANTDOC_CORN:  # held-out field test set, never used for training
                save(z.read(name), DATA / "plantdoc_test" / PLANTDOC_CORN[cls] / f"{p.parts[-3]}_{p.stem}.jpg")
                corn += 1
            else:
                others.append(name)
        except Exception:
            pass
    for name in random.sample(others, min(n_other, len(others))):
        try:
            save(z.read(name), DATA / "maize" / "other" / "plantdoc" / (Path(name).stem + ".jpg"))
        except Exception:
            pass
    print("plantdoc corn test", corn, "other", n_other)


if __name__ == "__main__":
    imagenette()
    plantdoc()
