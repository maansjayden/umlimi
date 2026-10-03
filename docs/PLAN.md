# Umlimi — offline maize scout + fair-price check (isiZulu)

Hack-Nation 7th Global AI Hackathon · Challenge 04 (World Bank Small AI for Development) · **Agriculture**
Deadline: **Sun 4 Oct 2026, 15:00 SAST** (uploads open +15 min).

## Problem statement (video sentence — fill in evidence)
Because of Umlimi, a smallholder maize farmer in KwaZulu-Natal will identify fall armyworm or leaf disease
and get a fair-price reference **on the day she sees it / the day the buyer arrives**, which she would
otherwise only get **when the extension officer next visits (months)**; we know because [extension ratio, FAW loss stats, SAFEX vs farm-gate gap].

## What it is
An installable, offline-first PWA for a cheap Android phone (one per household / co-op lead farmer).

1. **Scan (core, offline):** photo of a maize leaf → on-device quantized CNN (MobileNetV3, ~2–5 MB)
   → one of a *fixed list*: fall armyworm · grey leaf spot · northern leaf blight · common rust · healthy.
2. **Speak (offline):** answer played from pre-generated isiZulu clips (fixed answers, no generation at runtime → no hallucination).
3. **Fail-safe:** confidence < threshold OR photo not a maize leaf → *"Angiqiniseki — buza umeluleki wezolimo"*
   (I'm not sure — ask the extension officer). Case is queued (store-and-forward) and sent to the officer when signal returns.
4. **Fair price (offline w/ cached ref):** buyer offers R/ton → compare with last cached SAFEX spot minus transport differential
   → "offer is X% below reference". Reference refreshed when online (and by SMS for feature phones).
5. **Officer dashboard (online):** queued low-confidence cases on a map; officer confirms label → becomes new training data.
6. **Stretch — livestock:** cattle photo (+ reference object) → weight band → value band vs latest auction R/kg.

## Sponsor tools — where each fits (never in the offline core path)
- **Bright Data:** scrape SAFEX/Grain SA price series and auction R/kg reports → price reference + evidence.
- **ElevenLabs:** pre-generate the fixed answer clips (if isiZulu supported; else Meta MMS-TTS `zul`) + video narration.
- **Lovable:** officer dashboard / landing page (deployed link).

## Architecture
```
ml/            PyTorch training (CPU) → ONNX → int8 quantized → app/public/model/
app/           Vite + React PWA, onnxruntime-web (wasm), service worker caches model+audio+price
data/          datasets (gitignored) + DATA_CARD.md (sources, licenses, sizes, gaps)
docs/          plan, evaluation, video script
```

## Judging map
| Criterion | Weight | Our evidence |
|---|---|---|
| Small AI fidelity | 25% | runs in airplane mode on Android, model size in MB, latency |
| Development relevance | 20% | SA smallholders, FAW, price asymmetry, cited stats |
| Data grounding | 15% | DATA_CARD: sources, licenses, sizes, **what data does not cover** (lab vs field) |
| Evidence it works | 15% | held-out FIELD-photo accuracy, confusion matrix, abstention rate vs accuracy curve |
| Clarity / AI value | 15% | why not SMS/spreadsheet: vision on an unlabelled photo, offline, voice |
| Scalability | 10% | swap language clips + retrain head per crop/country; officer-confirmed labels loop |
| Responsible AI | pass/fail | abstain + escalate, human decides, data on device, consent, bias on field photos |

## Timeline (SAST)
| Time | Work |
|---|---|
| Sat 22:00–01:00 | datasets downloaded, data card, training baseline |
| 01:00–05:00 | PWA scaffold, ONNX in browser, scan flow, fail-safe |
| 05:00–08:00 | price check + scraped reference, isiZulu clips, queue/dashboard |
| 08:00–10:00 | stretch: livestock (only if core done) |
| 10:00–13:00 | eval on field photos, deploy, README, airplane-mode test on real phone |
| 13:00–14:45 | record videos (demo, tech, team), submit |

## Submission checklist
- [ ] Public GitHub repo + README
- [ ] Deployed demo link (no localhost)
- [ ] Video 2–5 min (problem sentence, AI + why not simpler, demo, where in her day, "your take on localizing AI")
- [ ] Tech video, team video
- [ ] Data sources cited + gaps stated
