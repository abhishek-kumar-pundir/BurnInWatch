# BurnInWatch Pipeline Overview

**Document version:** 1.0  
**Scope:** Data ingestion, preprocessing, feature extraction, ML screening models, backend inference, and digital twin interface.  
**Source reference:** Derived strictly from codebase implementations and notebooks in `notebooks/`.

---

## A. Data

### 1. Data Source & Provenance
* **Source Dataset:** NASA Ames Prognostics Data Repository — IGBT Accelerated Aging dataset.
* **Raw Files:**
  * 120 SMU characterization CSVs (device families `IGBT-IRG4BC30K` and `IGBT-IRG4PC50U`, tests `Breakdown.csv`, `LeakageIV.csv`, `TransferChar.csv`).
  * 12 MATLAB `.mat` thermal overstress aging experiments (devices aged under DC gate bias or square wave gate signal).
  * 1 Excel aging log (`Device Aging log.xls`).
* **Canonical Dataset:** `processed/burninwatch_aging_canonical_v1.csv`
  * Constructed by [`notebooks/01_canonical_aging_extraction.ipynb`](file:///c:/Users/Abhishek%20Kuma/Desktop/BurnInWatch/notebooks/01_canonical_aging_extraction.ipynb) (Cell 9).
  * Contains 68,761 valid steady-state records across 10 aging files spanning 4 physical IGBTs (`Device_2`, `Device_3`, `Device_4`, `Device_5`).
  * 8 rows were dropped during canonical extraction where all engineering measurements were entirely missing (`[Cell 9]`).

### 2. Measured Signals & Sampling
The canonical schema consists of 15 columns (8 required measurement columns):

| Column | Role | Data Type | Sampling Rate / Time Behavior |
|---|---|---|---|
| `timeEpoch` | Timestamp | Float64 | Sampling interval $\Delta t$: median = 0.200 s, mean = 0.228 s (`aging_time_summary.csv`). |
| `supplyVoltage` | Electrical context | Float64 | Stepped power supply levels ($V$): min 2.45 V, median 4.94 V, max 5.93 V. |
| `node1Voltage` | Upstream voltage | Float64 | Tracks supply voltage ($V$): min 2.45 V, median 4.94 V, max 5.93 V. |
| `node2Voltage` | Device collector voltage | Float64 | IGBT collector terminal voltage ($V$): min 1.33 V, median 4.37 V, max 5.92 V. |
| `collectorEmitterCurrent` | Device current | Float64 | Collector-emitter current ($A$): min -0.221 A, median 0.106 A, max 0.450 A. |
| `packageTemperature` | Thermal monitor | Float64 | Unit not recorded in repo; values 26–281 in the dataset (min 26.96, median 254.91, max 281.80). |
| `heatSinkTemperature` | Thermal monitor | Float64 | Heat sink sensor: min 718.77, median 719.14, max 719.46. |
| `internalTemperature` | Thermal monitor | Float64 | Internal sensor: min -2266.38, median -2261.69, max -2249.25. |
| `ambientTemperature` | Atmospheric | Float64 | **100% missing (all NaN)**; dropped in preprocessing (`[Notebook 02, Cell 3]`). |
| `measurement_valid` | Quality flag | Boolean | Extracted validity flag. |

### 3. Units Audit
* **Current & Voltages:** `supplyVoltage`, `node1Voltage`, and `node2Voltage` are calibrated in Volts ($V$). `collectorEmitterCurrent` is in Amperes ($A$), operating around 0.04 A – 0.20 A in the experimental setup.
* **Package Temperature:** Unit is not recorded in the repository or dataset documentation. Observed values range from 26.96 to 281.80 in `sample_burnin_device4_main.csv` (and 26 to 281 across the dataset). Documented as "unit not recorded in repo; values 26–281 in the dataset"; displayed as "dataset units" in the UI.
* **Internal and Heat Sink Temperatures:** In `processed/burninwatch_aging_canonical_v1.csv` and `processed/sample_burnin_device4_main.csv`, `internalTemperature` averages **-2260.58** and `heatSinkTemperature` averages **719.13** (`processed/eda_robust_statistics.csv`).
  * **Physical Reality:** These values cannot physically represent degrees Celsius ($^\circ\text{C}$). They are raw analog-to-digital converter (ADC) counts or uncalibrated voltage tap readings from the NASA acquisition hardware. Labeled as "raw sensor units (uncalibrated)".
  * **Code Assumption:** The ML pipeline treats them strictly as arbitrary numerical signals. **Critically, neither `internalTemperature` nor `heatSinkTemperature` is used as an input to either model (`response_focused` or `expanded`)** (`backend/src/burninwatch/config.py` line 43).
  * **Frontend Assumption:** The 3D Digital Twin GUI displays `internalTemperature` and `heatSinkTemperature` read-only with the label "raw sensor units (uncalibrated)" and note "Not used by the models", avoiding any physical Celsius claims.

---

## B. Preprocessing

The preprocessing pipeline is executed identically at training time ([`notebooks/05_expanded_overlapping_modeling.ipynb`](file:///c:/Users/Abhishek%20Kuma/Desktop/BurnInWatch/notebooks/05_expanded_overlapping_modeling.ipynb) lines 99–500) and inference time ([`backend/src/burninwatch/services/preprocessing.py`](file:///c:/Users/Abhishek%20Kuma/Desktop/BurnInWatch/backend/src/burninwatch/services/preprocessing.py)).

### 1. Ingestion & Cleaning
1. **Header Validation (`csv_service.parse_csv`):** Confirms all 8 required columns exist in the uploaded CSV.
2. **Type Casting (`preprocessing.coerce_numeric`):** Coerces all 8 columns to 64-bit floating point; invalid strings become `NaN`.
3. **Temporal Sorting & De-duplication (`preprocessing.sort_and_deduplicate`):** Sorts rows chronologically by `timeEpoch`. Drops any record sharing an exact duplicate timestamp.
4. **Finite Value Filter (`preprocessing.filter_rows`):** Drops any row containing `NaN` or `inf` in **any** of the 8 required columns. (Training notebook dropped rows with missing values in any required column; backend replicates this strictly).
5. **Length Guards:** Requires $\ge 100$ cleaned rows (`min_rows`); emits a warning if $< 300$ rows.

### 2. Baseline Estimation (`preprocessing.compute_baseline`)
To evaluate drift independent of device-to-device manufacturing offsets:
1. Define the baseline-train segment as the first 20% of cleaned rows:
   $$\text{train\_n} = \lfloor 0.20 \times N \rfloor$$
2. Define the reference region as the first 10% of that segment (min 20 rows):
   $$\text{ref\_n} = \max(20, \lfloor 0.10 \times \text{train\_n} \rfloor)$$
3. Compute the baseline scalar as the **median** over `ref_n` rows for:
   * `node2Voltage_baseline`
   * `collectorEmitterCurrent_baseline`
   * `packageTemperature_baseline`

### 3. Derived Engineering Features (`services/features.py`)
From the 5 active signals (`supplyVoltage`, `node1Voltage`, `node2Voltage`, `collectorEmitterCurrent`, `packageTemperature`), 11 instantaneous or window-level derived metrics are computed:
* **Node Voltage Drop:** $\Delta V_{\text{nodes}} = \text{node1Voltage} - \text{node2Voltage}$
* **Power Proxy:** $P_{\text{proxy}} = \text{collectorEmitterCurrent} \times \text{node2Voltage}$
* **Dynamic Conductance Proxy:** $G_{\text{proxy}} = \frac{\text{collectorEmitterCurrent}}{\text{node2Voltage} + 10^{-6}}$
* **Supply to Node 1 Difference:** $\text{diff}_{\text{supply, node1}} = \overline{\text{supplyVoltage}} - \overline{\text{node1Voltage}}$
* **Node 1 to Node 2 Difference:** $\text{diff}_{\text{node1, node2}} = \overline{\text{node1Voltage}} - \overline{\text{node2Voltage}}$
* **Node 2 Voltage Absolute Delta:** $\Delta V_{\text{baseline}} = \overline{\text{node2Voltage}} - V_{\text{baseline}}$
* **Node 2 Voltage Relative Change (%):** $\%\Delta V_{\text{baseline}} = \frac{\overline{\text{node2Voltage}} - V_{\text{baseline}}}{|V_{\text{baseline}}| + 10^{-6}} \times 100$
* **Current Absolute Delta:** $\Delta I_{\text{baseline}} = \overline{\text{collectorEmitterCurrent}} - I_{\text{baseline}}$
* **Current Relative Change (%):** $\%\Delta I_{\text{baseline}} = \frac{\overline{\text{collectorEmitterCurrent}} - I_{\text{baseline}}}{|I_{\text{baseline}}| + 10^{-6}} \times 100$
* **Package Temperature Delta:** $\Delta T_{\text{baseline}} = \overline{\text{packageTemperature}} - T_{\text{baseline}}$
* **Package Temperature Relative Change (%):** $\%\Delta T_{\text{baseline}} = \frac{\overline{\text{packageTemperature}} - T_{\text{baseline}}}{|T_{\text{baseline}}| + 10^{-6}} \times 100$

### 4. Sliding Window Aggregation (`services/windowing.py`)
* **Window Size:** $W = 100$ rows (approx. 20–25 seconds of burn-in test time).
* **Stride:** $S = 25$ rows (75% overlap between consecutive windows).
* **Summary Statistics per Window:**
  * Mean: $\mu$
  * Standard Deviation: $\sigma$
  * 5th Percentile: $q_{05}$
  * 95th Percentile: $q_{95}$
  * Interquartile Range: $\text{IQR} = q_{75} - q_{25}$
  * Normalized Time Linear Slope: $m$ from OLS fit against $t \in [0, 1]$.

### 5. Feature Sets: `response_focused` vs `expanded`
* **`expanded` (31 features):** All 20 response-focused features plus 11 absolute operating features (`supplyVoltage_mean`, `supplyVoltage_std`, `node2Voltage_mean`, `node2Voltage_q05`, `node2Voltage_q95`, `packageTemperature_mean`, `packageTemperature_q05`, `packageTemperature_q95`, `supply_node1_mean_diff`, `node1_node2_mean_diff`, `estimated_power_proxy`).
* **`response_focused` (20 features, Production Default):** Excludes absolute supply voltage and operating temperature levels so the models do not falsely flag benign external power supply or ambient chamber setpoint adjustments.

### 6. Scaling & Preprocessing Fit
* **Imputation & Scaling:** `SimpleImputer(strategy="median")` followed by `RobustScaler(with_centering=True, with_scaling=True)`.
* **Fit Target:** Fitted strictly on the 20% `baseline_train` windows in [`notebooks/05_expanded_overlapping_modeling.ipynb`](file:///c:/Users/Abhishek%20Kuma/Desktop/BurnInWatch/notebooks/05_expanded_overlapping_modeling.ipynb).
* **Storage:** Pickled inside each model's `.joblib` bundle. Loaded strictly at runtime.
* **Parity Verification:** Verified by [`backend/scripts/verify_parity.py`](file:///c:/Users/Abhishek%20Kuma/Desktop/BurnInWatch/backend/scripts/verify_parity.py) against `processed/burninwatch_expanded_overlapping_windows_v2.csv` with relative error $< 10^{-12}$.

---

## C. Models

### 1. Model Specifications & Hyperparameters

#### Detector 1: Isolation Forest
* **Algorithm:** `sklearn.ensemble.IsolationForest`
* **Hyperparameters:** `n_estimators=500`, `contamination="auto"`, `max_samples="auto"`, `bootstrap=False`, `random_state=42`.
* **Inference Formula:** Raw decision score from scikit-learn is shifted:
  $$\text{score}_{\text{IF}}(x) = - \text{score\_samples}(x)$$
  where higher score indicates greater abnormality.
* **Artifacts:**
  * `response_focused`: `backend/models/burninwatch_expanded_response_focused_IF.joblib`
  * `expanded`: `backend/models/burninwatch_expanded_expanded_IF.joblib`

#### Detector 2: PyTorch Autoencoder
* **Architecture:** Symmetric 4-layer Multilayer Perceptron:
  * Encoder: $\text{Linear}(\text{input\_dim}, \text{hidden\_dim}) \to \text{ReLU}() \to \text{Linear}(\text{hidden\_dim}, \text{bottleneck\_dim})$
  * Bottleneck: Linear bottleneck **without activation** function.
  * Decoder: $\text{Linear}(\text{bottleneck\_dim}, \text{hidden\_dim}) \to \text{ReLU}() \to \text{Linear}(\text{hidden\_dim}, \text{input\_dim})$
  * Layer Dimensions:
    * `response_focused` (20 features): $20 \to 40 \to 6 \to 40 \to 20$
    * `expanded` (31 features): $31 \to 62 \to 10 \to 62 \to 31$
* **Training Protocol:** Adam optimizer ($\text{lr}=10^{-3}$, $\text{weight\_decay}=10^{-4}$), MSE Loss, 150 epochs, batch size $\min(64, N_{\text{train}})$.
* **Inference Formula:** Mean Squared Error across all $d$ features:
  $$\text{score}_{\text{AE}}(x) = \frac{1}{d} \sum_{j=1}^d \left( x_j - \hat{x}_j \right)^2$$
* **Artifacts:**
  * `response_focused`: `backend/models/burninwatch_expanded_response_focused_AE.pt` + `..._AE_preprocess.joblib`
  * `expanded`: `backend/models/burninwatch_expanded_expanded_AE.pt` + `..._AE_preprocess.joblib`

### 2. Model Selection Rationale
* **Documented Evidence in Repository:** Notebooks 03, 04, and 05 (formerly 10, 11, and 12) implement and compare Isolation Forest and the Autoencoder across feature sets.
* **No Documented Rationale Found for:**
  * Why Isolation Forest was chosen over alternative one-class algorithms (e.g. One-Class SVM, Local Outlier Factor).
  * Why an MLP Autoencoder was selected over a recurrent LSTM-Autoencoder.
  * Why the specific bottleneck dimension ratio ($\approx \lfloor \text{input\_dim} / 3 \rfloor$) was chosen.
* **Likely Reasoning (Not Documented):**
  * *Isolation Forest* handles multi-modal tabular features effectively, scales well to thousands of windows, and isolates outliers without parametric distribution assumptions.
  * *Autoencoder* reconstructs non-linear coordinate correlations; when physical degradation violates standard multivariate coupling (e.g. current increasing while voltage drops), reconstruction error surges.
  * *LSTM-Autoencoder* was likely omitted because temporal dynamics are already summarized within each 100-sample window via slope, IQR, and standard deviation, avoiding recurrent training overhead.

### 3. Dual-Detector Consensus & Threshold Method
* **Threshold Selection Rule:**
  $$\tau_{\text{IF}} = \text{Quantile}_{0.95}\left(\text{Scores}_{\text{IF, validation}}\right), \quad \tau_{\text{AE}} = \text{Quantile}_{0.95}\left(\text{Scores}_{\text{AE, validation}}\right)$$
  * Implication: By mathematical construction, **exactly ~5% of normal validation windows exceed each detector's threshold**. This is a relative screening threshold indicating statistical departure from baseline, not an absolute failure probability.
* **Calibrated Threshold Values (Loaded from Artifacts):**
  * `response_focused`: $\tau_{\text{IF}} = 0.069082$ (`0.06908179599444629`), $\tau_{\text{AE}} = 0.287608$ (`0.2876077890396118`)
  * `expanded`: $\tau_{\text{IF}} = 0.104584$ (`0.10458415425735054`), $\tau_{\text{AE}} = 0.360705$ (`0.36070457100868225`)
* **Consensus Classification:**
  * `NORMAL`: $\text{score}_{\text{IF}} \le \tau_{\text{IF}}$ **and** $\text{score}_{\text{AE}} \le \tau_{\text{AE}}$
  * `REVIEW`: Either detector flags alone (one model detects an unusual window).
  * `ANOMALY`: Both detectors flag concurrently ($\text{score}_{\text{IF}} > \tau_{\text{IF}}$ **and** $\text{score}_{\text{AE}} > \tau_{\text{AE}}$).

### 4. Design Decisions: Documented vs Not Documented

| Design Decision | Status | Documented Evidence in Repository | Likely Reasoning (Not Documented) |
|---|---|---|---|
| **Dual feature sets (`response_focused` vs `expanded`)** | Documented | `notebooks/05_expanded_overlapping_modeling.ipynb` Cell 0 / output 7 compares both: `response_focused` achieved higher detector score correlation (0.5815 vs 0.3768), lower AE final loss (0.0484 vs 0.0539), and avoided flagging benign external voltage stepping. | N/A |
| **Window size = 100, Stride = 25** | Documented | `notebooks/05_expanded_overlapping_modeling.ipynb` and `models/burninwatch_expanded_artifacts_v2.json`. 100 samples (~20–25s) provides sufficient statistical support for quantiles/slope; 75% overlap ensures smooth transition tracking. | N/A |
| **Baseline from first 2% rows (10% of 20% train)** | Documented | Implemented across `notebooks/05_expanded_overlapping_modeling.ipynb` and `backend/src/burninwatch/services/preprocessing.py`. Establishes nominal reference before thermal or electrical degradation begins. | N/A |
| **95th percentile validation threshold ($\tau_{0.95}$)** | Documented | `notebooks/05_expanded_overlapping_modeling.ipynb` Cell 0 / `models/burninwatch_expanded_artifacts_v2.json`. Calibrated on nominal validation windows to cap nominal false alarms at ~5% per detector. | N/A |
| **Exclusion of `internalTemperature` and `heatSinkTemperature`** | Documented | `notebooks/02_eda_data_quality.ipynb` and `notebooks/archive/07_experiment_aware_preprocessing_features.ipynb`: identified unusual numerical scales (-2261 and +719) as raw uncalibrated ADC counts; omitted from feature manifests. | N/A |
| **Isolation Forest algorithm selection** | Not documented | No documented rationale found in notebooks or repo. | Standard choice for multi-modal tabular data; scales efficiently with $O(n \log n)$; isolates points without parametric assumptions. |
| **MLP Autoencoder architecture selection** | Not documented | No documented rationale found in notebooks or repo. | Reconstructs non-linear coordinate correlations across features; anomalies violate learned joint distributions, producing high reconstruction error. |
| **Bottleneck dimension ($\approx \lfloor d/3 \rfloor$)** | Not documented | No documented rationale found in notebooks or repo. | Standard dimension reduction ratio (~3:1 compression) forcing the bottleneck to capture dominant shared manifolds without memorizing noise. |
| **Omission of LSTM / recurrent architecture** | Not documented | No documented rationale found in notebooks or repo. | Intra-window temporal dynamics are already explicitly summarized by slope, standard deviation, and IQR features, obviating recurrent sequence modeling overhead. |
| **Consensus logic (AND = ANOMALY, XOR = REVIEW)** | Documented | `notebooks/05_expanded_overlapping_modeling.ipynb` output 7: analyzes detector overlap (`both_models_flagged` = 124, `IF_only` = 47, `AE_only` = 69). Dual-confirmation minimizes false alarms. | N/A |

---

## D. Backend Connection

### 1. Request Flow
```
Upload CSV (POST /api/v1/screenings/analyze)
  │
  ├─► 1. csv_service.parse_csv
  │       Decode bytes, validate headers (REQUIRED_COLUMNS)
  │
  ├─► 2. preprocessing.clean
  │       Coerce float64, sort timeEpoch, drop NaNs/inf
  │
  ├─► 3. preprocessing.compute_baseline
  │       Compute median of first ~2% rows for V_node2, I_CE, T_pkg
  │
  ├─► 4. windowing.create_windows & features.extract_features
  │       100-row windows, stride 25; extract 20 (or 31) features
  │
  ├─► 5. ml.model_registry.get -> inference.score_windows
  │       Transform via imputer + RobustScaler
  │       Run IsolationForest.score_samples & Autoencoder.forward
  │
  ├─► 6. inference.assign_window_status
  │       Apply consensus thresholds: NORMAL / REVIEW / ANOMALY
  │
  ├─► 7. xai.explain_window
  │       AE per-feature squared error + IF baseline substitution
  │
  ├─► 8. episodes.merge_episodes
  │       Merge consecutive ANOMALY windows (gap tolerance = 2 windows)
  │
  └─► 9. ScreeningResponse (Pydantic schema returned to caller)
```

### 2. Artifact Provenance Matrix

| Artifact File | Produced By | Loaded By | Runtime Purpose |
|---|---|---|---|
| `burninwatch_expanded_response_focused_IF.joblib` | `notebooks/05_expanded_overlapping_modeling.ipynb` | `backend/src/burninwatch/ml/model_registry.py` | Imputer, RobustScaler, Isolation Forest estimator, and $\tau_{\text{IF}}$ threshold. |
| `burninwatch_expanded_response_focused_AE_preprocess.joblib` | `notebooks/05_expanded_overlapping_modeling.ipynb` | `backend/src/burninwatch/ml/model_registry.py` | Feature scaler pipeline strictly aligned to the Autoencoder input dimension. |
| `burninwatch_expanded_response_focused_AE.pt` | `notebooks/05_expanded_overlapping_modeling.ipynb` | `backend/src/burninwatch/ml/model_registry.py` & `autoencoder.py` | PyTorch `BurnInAutoencoder` state dictionary and $\tau_{\text{AE}}$ threshold. |
| `burninwatch_expanded_artifacts_v2.json` | `notebooks/05_expanded_overlapping_modeling.ipynb` | `scripts/exportDigitalTwinReplay.py` | Provides metadata and threshold reference for offline replay export. |
| `sample_burnin_device4_main.csv` | Extraction slice from `burninwatch_aging_canonical_v1.csv` | `scripts/exportDigitalTwinReplay.py` & `verify_parity.py` | Source test file for 3D twin digital replay and system verification parity tests. |
| `offline_evaluation.json` | `backend/scripts/build_offline_evaluation.py` | `backend/src/burninwatch/api/routes/evaluation.py` | Supplies offline test metrics and agreement percentages to the frontend `/performance` page. |

---

## E. Known Limitations & Risks

1. **Unsupervised Only (No Ground Truth Failure Labels):**
   * The NASA accelerated aging dataset does not provide binary good/bad labels for intermediate windows. Consequently, traditional classification metrics (Precision, Recall, ROC-AUC, F1-score) **cannot be computed** without fabricating synthetic labels.
2. **Relative Statistical Filter (Not a Failure Probability):**
   * The 95th percentile validation threshold flags approximately 5% of nominal data by design. An `ANOMALY` or `REVIEW` flag denotes a statistically significant departure from early burn-in operating behavior, not guaranteed physical destruction.
3. **Single-Device Real Replay Sample:**
   * The 3D Digital Twin replay mode (`frontend/public/digitalTwin/replay.json`) runs on `sample_burnin_device4_main.csv` (Device 4). Generalization to other power semiconductor packages requires fitting baselines to each specific device family.
4. **Uncalibrated Temperature Sensors:**
   * `internalTemperature` and `heatSinkTemperature` are uncalibrated ADC readings (e.g. -2261) and are deliberately ignored by the ML models.
5. **Class Presentation Claims (What Can Be Honestly Stated):**
   * *Can claim:* Fully automated end-to-end unsupervised anomaly-screening service; dual-detector consensus combining tree-based partitioning with neural reconstruction; feature parity down to $10^{-12}$ between research and production; per-window explainability ranking top contributing signals.
   * *Cannot claim:* Failure prediction probability (no "87% chance of blowout"); remaining useful life (RUL) estimation; causal physical root-cause diagnosis.

