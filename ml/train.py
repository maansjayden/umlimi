"""Fine-tune MobileNetV3 on maize leaves (CPU-friendly), choose the abstain threshold, export int8 ONNX.

Usage: python ml/train.py [--epochs 6] [--per-class 1800]
Outputs: ml/out/{best.pt, metrics.json, confusion.png, coverage.png}, app/public/model/{maize.onnx, meta.json}
"""
import argparse
import json
import random
import time
from collections import Counter
from pathlib import Path

import numpy as np
import timm
import torch
import torch.nn as nn
from PIL import Image
from sklearn.metrics import classification_report, confusion_matrix
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms as T

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "ml" / "out"
APP_MODEL = ROOT / "app" / "public" / "model"
LABELS = ["faw", "gls", "nlb", "rust", "healthy", "other"]
SIZE = 224
MEAN, STD = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)
TARGET_ACC = 0.95  # accuracy we require on the answers the app does give

torch.set_num_threads(4)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
WORKERS = 2 if DEVICE == "cuda" else 4
random.seed(0)
torch.manual_seed(0)


def source_of(p: Path) -> str:
    """Original source dataset, encoded in daiv05 filenames: '<class>_<source>_<env>_<id>'."""
    if p.parent.parent.name == "other":
        return p.parent.name
    stem = p.stem
    for env in ("_real_", "_lab_"):
        if env in stem:
            return stem.split(env)[0].split("_", 2)[-1] + env.strip("_")
    return "unknown"


def collect(per_class: int):
    train, val, test = [], [], []
    for li, lab in enumerate(LABELS):
        files = sorted(f for f in (DATA / "maize" / lab).rglob("*") if f.suffix.lower() in {".jpg", ".jpeg"})
        random.shuffle(files)
        # prefer field photos: take all 'real' first, then fill with lab images
        files.sort(key=lambda p: 0 if "/real/" in str(p) or lab == "other" else 1)
        files = files[: int(per_class / 0.8)]
        random.shuffle(files)
        n = len(files)
        a, b = int(0.8 * n), int(0.9 * n)
        train += [(f, li) for f in files[:a]]
        val += [(f, li) for f in files[a:b]]
        test += [(f, li) for f in files[b:]]
    return train, val, test


def plantdoc_test():
    items = []
    for lab in ("gls", "nlb", "rust"):
        items += [(f, LABELS.index(lab)) for f in sorted((DATA / "plantdoc_test" / lab).glob("*.jpg"))]
    return items


class DS(Dataset):
    def __init__(self, items, tf):
        self.items, self.tf = items, tf

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        p, y = self.items[i]
        return self.tf(Image.open(p).convert("RGB")), y


train_tf = T.Compose([
    T.RandomResizedCrop(SIZE, scale=(0.5, 1.0)),
    T.RandomHorizontalFlip(), T.RandomVerticalFlip(), T.RandomRotation(20),
    # field conditions: harsh sun, shade, phone cameras
    T.ColorJitter(0.4, 0.4, 0.3, 0.05), T.RandomApply([T.GaussianBlur(5)], p=0.2),
    T.ToTensor(), T.Normalize(MEAN, STD),
])
eval_tf = T.Compose([T.Resize(SIZE), T.CenterCrop(SIZE), T.ToTensor(), T.Normalize(MEAN, STD)])


@torch.no_grad()
def predict(model, items):
    model.eval()
    probs, ys = [], []
    for x, y in DataLoader(DS(items, eval_tf), batch_size=64, num_workers=WORKERS):
        probs.append(model(x.to(DEVICE)).softmax(1).cpu())
        ys.append(y)
    return torch.cat(probs).numpy(), torch.cat(ys).numpy()


def predict_onnx(path, items):
    import onnxruntime as ort

    sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    probs = []
    for x, _ in DataLoader(DS(items, eval_tf), batch_size=1, num_workers=WORKERS):
        logits = sess.run(None, {"input": x.numpy()})[0]
        probs.append(torch.from_numpy(logits).softmax(1))
    return torch.cat(probs).numpy()


def pick_threshold(probs, ys):
    """Lowest threshold whose answered (non-abstained) cases reach TARGET_ACC; maximises coverage."""
    conf, pred = probs.max(1), probs.argmax(1)
    curve = []
    for t in np.arange(0.3, 0.996, 0.01):
        keep = conf >= t
        acc = (pred[keep] == ys[keep]).mean() if keep.any() else 1.0
        curve.append((float(t), float(keep.mean()), float(acc)))
    ok = [c for c in curve if c[2] >= TARGET_ACC]
    return (ok[0][0] if ok else 0.9), curve


def selective_report(probs, ys, t):
    conf, pred = probs.max(1), probs.argmax(1)
    keep = conf >= t
    return {
        "n": int(len(ys)),
        "accuracy_all": float((pred == ys).mean()),
        "coverage": float(keep.mean()),
        "accuracy_answered": float((pred[keep] == ys[keep]).mean()) if keep.any() else None,
        "abstained": int((~keep).sum()),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=6)
    ap.add_argument("--per-class", type=int, default=1800)
    ap.add_argument("--arch", default="mobilenetv3_large_100")
    ap.add_argument("--unfreeze-all", action="store_true", help="full fine-tune (use on a GPU)")
    ap.add_argument("--lr", type=float, default=1e-3)
    args = ap.parse_args()
    print("device", DEVICE)
    OUT.mkdir(parents=True, exist_ok=True)

    train, val, test = collect(args.per_class)
    print("train", Counter(LABELS[y] for _, y in train))
    print("val/test", len(val), len(test))

    model = timm.create_model(args.arch, pretrained=True, num_classes=len(LABELS))
    # freeze the early blocks: faster on CPU and less overfitting to studio images
    for name, p in model.named_parameters():
        if not args.unfreeze_all and name.startswith(("conv_stem", "bn1", "blocks.0", "blocks.1", "blocks.2")):
            p.requires_grad = False

    counts = Counter(y for _, y in train)
    weights = torch.tensor([len(train) / (len(LABELS) * max(counts[i], 1)) for i in range(len(LABELS))], dtype=torch.float)
    model.to(DEVICE)
    loss_fn = nn.CrossEntropyLoss(weight=weights.to(DEVICE), label_smoothing=0.1)
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=args.lr, weight_decay=1e-4)
    loader = DataLoader(DS(train, train_tf), batch_size=48, shuffle=True, num_workers=WORKERS, drop_last=True)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=args.epochs * len(loader))

    best = 0.0
    for ep in range(args.epochs):
        model.train()
        t0, tot, correct, n = time.time(), 0.0, 0, 0
        for i, (x, y) in enumerate(loader):
            x, y = x.to(DEVICE), y.to(DEVICE)
            out = model(x)
            loss = loss_fn(out, y)
            opt.zero_grad()
            loss.backward()
            opt.step()
            sched.step()
            tot += loss.item() * len(y)
            correct += (out.argmax(1) == y).sum().item()
            n += len(y)
            if i % 20 == 0:
                print(f"  ep{ep} {i}/{len(loader)} loss {tot / n:.3f} acc {correct / n:.3f}", flush=True)
        vp, vy = predict(model, val)
        vacc = (vp.argmax(1) == vy).mean()
        print(f"epoch {ep}: train {correct / n:.3f} val {vacc:.3f} ({time.time() - t0:.0f}s)", flush=True)
        if vacc > best:
            best = vacc
            torch.save(model.state_dict(), OUT / "best.pt")

    model.load_state_dict(torch.load(OUT / "best.pt", map_location=DEVICE))
    vp, vy = predict(model, val)
    threshold, curve = pick_threshold(vp, vy)

    metrics = {"arch": args.arch, "threshold": threshold, "labels": LABELS, "train_counts": dict(Counter(LABELS[y] for _, y in train))}
    tp, ty = predict(model, test)
    metrics["test_in_distribution"] = selective_report(tp, ty, threshold)
    metrics["test_report"] = classification_report(ty, tp.argmax(1), labels=list(range(len(LABELS))), target_names=LABELS, output_dict=True, zero_division=0)
    # Per-source accuracy: exposes where lab-heavy classes (rust) are weak on field photos.
    by_src = {}
    for (p, y), pr in zip(test, tp):
        s = f"{LABELS[y]}:{source_of(p)}"
        by_src.setdefault(s, []).append(int(pr.argmax() == y))
    metrics["test_by_source"] = {k: {"n": len(v), "acc": sum(v) / len(v)} for k, v in sorted(by_src.items())}

    pd_items = plantdoc_test()
    if pd_items:  # PlantDoc: independent web/field photos, different photographers, never seen in training
        pp, py = predict(model, pd_items)
        metrics["test_plantdoc_field"] = selective_report(pp, py, threshold)
        metrics["plantdoc_confusion"] = confusion_matrix(py, pp.argmax(1), labels=list(range(len(LABELS)))).tolist()
    metrics["coverage_curve_val"] = curve

    cm = confusion_matrix(ty, tp.argmax(1), labels=list(range(len(LABELS))))
    metrics["test_confusion"] = cm.tolist()
    plots(cm, curve, threshold)
    export(model, threshold, val)
    # What ships is the int8 file, so measure it, not just the PyTorch model.
    metrics["test_int8_onnx"] = selective_report(predict_onnx(APP_MODEL / "maize.onnx", test), ty, threshold)
    (OUT / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps({k: metrics[k] for k in ("threshold", "test_in_distribution", "test_int8_onnx")}, indent=2))
    if "test_plantdoc_field" in metrics:
        print("plantdoc", metrics["test_plantdoc_field"])


def plots(cm, curve, threshold):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(6, 5))
    ax.imshow(cm, cmap="Greens")
    ax.set_xticks(range(len(LABELS)), LABELS)
    ax.set_yticks(range(len(LABELS)), LABELS)
    ax.set_xlabel("predicted")
    ax.set_ylabel("true")
    for i in range(len(LABELS)):
        for j in range(len(LABELS)):
            ax.text(j, i, cm[i, j], ha="center", va="center", fontsize=9)
    ax.set_title("Held-out test set")
    fig.tight_layout()
    fig.savefig(OUT / "confusion.png", dpi=150)

    t, cov, acc = zip(*curve)
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.plot(t, acc, label="accuracy on answered")
    ax.plot(t, cov, label="coverage (answered)")
    ax.axvline(threshold, ls="--", c="grey", label=f"threshold {threshold:.2f}")
    ax.set_xlabel("confidence threshold")
    ax.legend()
    ax.set_title("Abstain → 'ask the extension officer'")
    fig.tight_layout()
    fig.savefig(OUT / "coverage.png", dpi=150)


def export(model, threshold, calib_items):
    from onnxruntime.quantization import CalibrationDataReader, QuantFormat, QuantType, quantize_static
    from onnxruntime.quantization.shape_inference import quant_pre_process

    APP_MODEL.mkdir(parents=True, exist_ok=True)
    model = model.cpu().eval()
    fp32, pre = OUT / "maize_fp32.onnx", OUT / "maize_pre.onnx"
    torch.onnx.export(model, torch.randn(1, 3, SIZE, SIZE), fp32, input_names=["input"], output_names=["logits"],
                      opset_version=17, dynamo=False)
    quant_pre_process(str(fp32), str(pre))

    class Reader(CalibrationDataReader):
        def __init__(self):
            sample = random.sample(calib_items, min(200, len(calib_items)))
            self.it = iter([{"input": eval_tf(Image.open(p).convert("RGB")).unsqueeze(0).numpy()} for p, _ in sample])

        def get_next(self):
            return next(self.it, None)

    q = APP_MODEL / "maize.onnx"
    quantize_static(str(pre), str(q), Reader(), quant_format=QuantFormat.QDQ,
                    activation_type=QuantType.QUInt8, weight_type=QuantType.QInt8, per_channel=True)
    meta = {"labels": LABELS, "input_size": SIZE, "mean": MEAN, "std": STD, "threshold": round(threshold, 3),
            "version": time.strftime("%Y-%m-%d")}
    (APP_MODEL / "meta.json").write_text(json.dumps(meta, indent=2))
    print(f"onnx fp32 {fp32.stat().st_size / 1e6:.1f} MB -> int8 {q.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
