"""CPU-fast training: frozen ImageNet MobileNetV3 features + a trained linear head.

Forward passes only (no backprop through the backbone), so it runs on a laptop CPU. Each training image
contributes `--views` augmented crops so the head still sees field-like variation.
Reuses data split, threshold choice, metrics and int8 export from train.py.
"""
import argparse
import json
from collections import Counter

import numpy as np
import timm
import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import DataLoader

import train as T  # same data split, transforms, reporting and export

torch.set_num_threads(4)


@torch.no_grad()
def embed(backbone, items, tf, views=1):
    backbone.eval()
    feats, ys = [], []
    for v in range(views):
        for i, (x, y) in enumerate(DataLoader(T.DS(items, tf), batch_size=64, num_workers=3)):
            feats.append(backbone(x))
            ys.append(y)
            if i % 20 == 0:
                print(f"  view {v} batch {i}", flush=True)
    return torch.cat(feats), torch.cat(ys)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-class", type=int, default=1500)
    ap.add_argument("--views", type=int, default=2)
    ap.add_argument("--arch", default="mobilenetv3_large_100")
    args = ap.parse_args()
    T.OUT.mkdir(parents=True, exist_ok=True)

    train, val, test = T.collect(args.per_class)
    print("train", Counter(T.LABELS[y] for _, y in train), flush=True)

    model = timm.create_model(args.arch, pretrained=True, num_classes=len(T.LABELS))
    head = model.get_classifier()
    model.reset_classifier(0)  # backbone now returns pooled features
    xtr, ytr = embed(model, train, T.train_tf, args.views)
    xva, yva = embed(model, val, T.eval_tf)

    lin = nn.Linear(xtr.shape[1], len(T.LABELS))
    counts = Counter(ytr.tolist())
    w = torch.tensor([len(ytr) / (len(T.LABELS) * max(counts[i], 1)) for i in range(len(T.LABELS))])
    loss_fn = nn.CrossEntropyLoss(weight=w, label_smoothing=0.05)
    opt = torch.optim.AdamW(lin.parameters(), lr=3e-3, weight_decay=1e-3)
    best, best_state = 0, None
    for ep in range(200):
        perm = torch.randperm(len(xtr))
        for i in range(0, len(perm), 256):
            idx = perm[i:i + 256]
            loss = loss_fn(lin(xtr[idx]), ytr[idx])
            opt.zero_grad()
            loss.backward()
            opt.step()
        with torch.no_grad():
            acc = (lin(xva).argmax(1) == yva).float().mean().item()
        if acc > best:
            best, best_state = acc, {k: v.clone() for k, v in lin.state_dict().items()}
        if ep % 20 == 0:
            print(f"epoch {ep} val {acc:.3f}", flush=True)
    print(f"best val {best:.3f}")

    # put the trained head back into the full model so export/eval code is shared with train.py
    model.reset_classifier(len(T.LABELS))
    model.get_classifier().load_state_dict(best_state)
    torch.save(model.state_dict(), T.OUT / "best.pt")

    vp, vy = T.predict(model, val)
    threshold, curve = T.pick_threshold(vp, vy)
    metrics = {"arch": args.arch, "method": "frozen backbone + linear head", "threshold": threshold,
               "labels": T.LABELS, "train_counts": dict(Counter(T.LABELS[y] for _, y in train))}
    tp, ty = T.predict(model, test)
    metrics["test_in_distribution"] = T.selective_report(tp, ty, threshold)
    from sklearn.metrics import classification_report, confusion_matrix
    metrics["test_report"] = classification_report(ty, tp.argmax(1), labels=list(range(len(T.LABELS))),
                                                   target_names=T.LABELS, output_dict=True, zero_division=0)
    by_src = {}
    for (p, y), pr in zip(test, tp):
        by_src.setdefault(f"{T.LABELS[y]}:{T.source_of(p)}", []).append(int(pr.argmax() == y))
    metrics["test_by_source"] = {k: {"n": len(v), "acc": sum(v) / len(v)} for k, v in sorted(by_src.items())}
    pd_items = T.plantdoc_test()
    if pd_items:
        pp, py = T.predict(model, pd_items)
        metrics["test_plantdoc_field"] = T.selective_report(pp, py, threshold)
        metrics["plantdoc_confusion"] = confusion_matrix(py, pp.argmax(1), labels=list(range(len(T.LABELS)))).tolist()
    cm = confusion_matrix(ty, tp.argmax(1), labels=list(range(len(T.LABELS))))
    metrics["test_confusion"] = cm.tolist()
    metrics["coverage_curve_val"] = curve
    (T.OUT / "metrics.json").write_text(json.dumps(metrics, indent=2))
    T.plots(cm, curve, threshold)
    T.export(model, threshold, val)
    print(json.dumps({k: metrics[k] for k in ("threshold", "test_in_distribution")}, indent=2))
    if "test_plantdoc_field" in metrics:
        print("plantdoc", metrics["test_plantdoc_field"])


if __name__ == "__main__":
    main()
