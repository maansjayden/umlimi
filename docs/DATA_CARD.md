# Data card — Umlimi

Every dataset the tool learns from or shows to the user, with source, licence, size, and what it does **not** cover.
Figures marked *(to fill)* are written by `ml/train.py` into `ml/out/metrics.json` after training.

## 1. Data we build with

| Dataset | Used for | Licence | What we used |
|---|---|---|---|
| **daiv05 / Corn Leaf Diseases, Pests and Deficiencies** — huggingface.co/datasets/daiv05/corn-leaf-diseases-pests-and-deficiencies | train / val / test for 5 maize classes | CC BY-NC-SA 4.0 (aggregates 8 public sources) | fall armyworm, grey leaf spot, northern leaf blight, common rust, healthy. Lethal necrosis and N/P/K deficiency classes skipped. Images resized to 320 px. |
| **PlantDoc** — github.com/pratikkayal/PlantDoc-Dataset | (a) **independent field test set** for corn grey leaf spot / blight / rust — never used in training; (b) non-maize leaves for the "not a maize leaf" class | CC BY 4.0 | 376 corn test images; 900 non-corn leaves |
| **Imagenette (fast.ai)** — github.com/fastai/imagenette | "not a maize leaf" class (everyday objects) | Apache 2.0 | 900 images |
| **JSE SAFEX maize settlements** via derivative.co.za/safex-prices.html, fetched with Bright Data Web Unlocker | fair-price reference cached on the phone | public, indicative prices | white + yellow maize R/ton, ~30 trading days, refreshed when online |

Split: 80 / 10 / 10 per class (seed 0), field ("real") photos preferred over lab photos when a class is capped.
The abstain threshold is chosen on the validation split as the lowest confidence at which answered cases are ≥ 95 % correct.

## 2. What the data does NOT cover (known gaps)

- **Common rust is mostly lab photos.** ~2,150 lab vs ~106 field images. Rust accuracy on field photos is the weakest number we report; we test it on PlantDoc field photos rather than trusting the in-distribution score.
- **No South African photos.** Field images come mainly from East/West Africa and Latin America. South African cultivars, soils, light, and phone cameras are not represented. First step after the hackathon: collect officer-confirmed photos through the app's own queue.
- **One leaf, one problem.** Real leaves often carry two problems at once, or nutrient stress that looks like disease. The model picks one class; mixed cases should fall below the threshold and go to the officer.
- **Fall armyworm is judged from leaf damage**, not from seeing the larva. Other chewing insects (e.g. stalk borer) can leave similar holes. The advice says "check the whorl for larvae" for that reason.
- **No maize streak virus, lethal necrosis, or nutrient-deficiency classes** in the shipped model, though they occur in SA. A leaf with these should land in "not sure".
- **SAFEX is not the farm-gate price.** It is a Randfontein delivery price. The farm-gate estimate subtracts an *assumed* transport cost (R2.50/t/km) and handling (R80/t, Grain SA's example location differential). Real differentials vary by silo; the app shows its assumptions and the price date.
- **Licence:** the daiv05 data is NonCommercial. A commercial deployment would need retraining on commercially licensed or self-collected data.

## 3. Data that shows the problem (cite in video)

| Fact | Source |
|---|---|
| 2.4 million agricultural households in SA | Stats SA, Census 2022 Agricultural Households report 03-11-01 |
| ~1 extension worker per 1,053 farmers (1:415 North West to 1:2,174 Mpumalanga) | DALRRD 2021, cited in Frontiers in Sustainable Food Systems 2026, doi 10.3389/fsufs.2026.1809319 |
| Fall armyworm confirmed in SA Feb 2017; potential African maize losses 8.3–20.6 Mt/yr (21–53 %) | CABI 2017 evidence note (Day et al.) |
| 1 GB mobile data ≈ R20.50 (2025) | MyBroadband / ITU basket, Feb 2026 |

## 4. Privacy and consent

- Photos and results stay on the phone (browser storage). "Not sure" cases are queued on the phone, but nothing is uploaded until the farmer agrees: by tapping "Send to officer" or ticking the consent box on the queue screen.
- A queued case holds a 160 px thumbnail, the label and the confidence. No name, phone number or GPS.
- Lost or shared phone: the queue is a short list of leaf thumbnails with no personal data. Clearing browser data wipes it.

## 5. Results *(to fill from ml/out/metrics.json)*

| Test set | Accuracy (all) | Coverage | Accuracy when it answers |
|---|---|---|---|
| In-distribution held-out (daiv05) | | | |
| Same, int8 ONNX as shipped | | | |
| PlantDoc field photos (never seen) | | | |
