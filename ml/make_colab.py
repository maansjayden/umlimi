"""Build ml/train_colab.ipynb from the real scripts, so the notebook never drifts from the code.

Run: python ml/make_colab.py  -> upload ml/train_colab.ipynb to colab.research.google.com (Runtime -> T4 GPU).
"""
import json
from pathlib import Path

ML = Path(__file__).resolve().parent
SCRIPTS = ["fetch_daiv05.py", "fetch_other.py", "train.py"]


def md(text):
    return {"cell_type": "markdown", "metadata": {}, "source": text}


def code(text):
    return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": text}


cells = [
    md("# Umlimi — train the maize leaf model on a GPU\n\n"
       "1. **Runtime → Change runtime type → T4 GPU**\n"
       "2. **Runtime → Run all** (about 30–45 min: ~15 min download, ~15 min training)\n"
       "3. The last cell downloads `umlimi_model.zip`. Unzip it into the repo: "
       "`maize.onnx` + `meta.json` → `app/public/model/`, the rest → `ml/out/`.\n"),
    code("!nvidia-smi --query-gpu=name,memory.total --format=csv\n"
         "!pip -q install timm onnx onnxruntime onnxscript\n"
         "!mkdir -p /content/umlimi/ml /content/umlimi/app/public/model"),
]
for name in SCRIPTS:
    cells.append(code(f"%%writefile /content/umlimi/ml/{name}\n" + (ML / name).read_text()))
cells += [
    md("## Download data\nAll the shards for the 5 classes (lethal necrosis is skipped), plus 'not a maize leaf' "
       "images and the PlantDoc field test set."),
    code("%cd /content/umlimi\n"
         "!UMLIMI_SHARDS=0,1,2,3,4,5,6,7,8,9,10,11,12,17,18,19,20,21,22 python ml/fetch_daiv05.py & python ml/fetch_other.py; wait\n"
         "!for d in data/maize/*/* data/plantdoc_test/*; do echo \"$d $(ls $d | wc -l)\"; done"),
    md("## Train (full fine-tune on GPU), pick the abstain threshold, export int8 ONNX"),
    code("%cd /content/umlimi\n!python ml/train.py --unfreeze-all --epochs 12 --per-class 2500 --lr 1e-3"),
    code("import json\nfrom IPython.display import Image, display\n"
         "m = json.load(open('/content/umlimi/ml/out/metrics.json'))\n"
         "for k in ('threshold', 'test_in_distribution', 'test_int8_onnx', 'test_plantdoc_field'):\n"
         "    print(k, m.get(k))\n"
         "for k, v in m['test_by_source'].items():\n"
         "    print(f\"{k:45s} n={v['n']:4d} acc={v['acc']:.3f}\")\n"
         "display(Image('/content/umlimi/ml/out/confusion.png'), Image('/content/umlimi/ml/out/coverage.png'))"),
    code("%cd /content/umlimi\n"
         "!zip -j umlimi_model.zip app/public/model/maize.onnx app/public/model/meta.json "
         "ml/out/metrics.json ml/out/confusion.png ml/out/coverage.png\n"
         "from google.colab import files\nfiles.download('/content/umlimi/umlimi_model.zip')"),
]

nb = {
    "cells": cells,
    "metadata": {"accelerator": "GPU", "colab": {"provenance": []},
                 "kernelspec": {"name": "python3", "display_name": "Python 3"}},
    "nbformat": 4,
    "nbformat_minor": 0,
}
(ML / "train_colab.ipynb").write_text(json.dumps(nb, indent=1))
print("wrote", ML / "train_colab.ipynb")
