# CropWise Frontend

A responsive plain HTML/CSS/JavaScript frontend for the Crop Stress & Irrigation Priority Decision Support project.

## Run locally
1. Extract this folder.
2. Open a terminal in this folder.
3. Run `python -m http.server 5500`
4. Open `http://localhost:5500`

You can also use VS Code Live Server.

## Connect your teammate's FastAPI backend
Open `app.js` and set:
`const API_BASE = "http://127.0.0.1:8000";`

The backend must enable CORS for the frontend origin (for example `http://localhost:5500`).

## API contract to share with the backend developer

### 1. `GET /api/health`
Response:
```json
{"status":"ok"}
```

### 2. `POST /api/predict`
Accept JSON field names matching the notebook's feature names. The form sends the fields included in the UI, such as `Crop_Type`, `Crop_Growth_Stage`, `Soil_Moisture_Current_10cm_Pct`, `Ambient_Air_Temperature_C`, etc.

Suggested response:
```json
{
  "risk_category": "High",
  "confidence": 0.87,
  "priority_score": 82,
  "priority_explanation": "High predicted stress with low near-surface moisture and limited recent rainfall.",
  "contributing_factors": [
    {"feature":"Soil_Moisture_Current_10cm_Pct","value":"18.2%","impact":"high"}
  ]
}
```
`confidence` should be a probability from 0 to 1. If the model cannot provide reliable confidence, omit it. The priority score must be calculated and documented by the project team; do not present it as model output unless it is actually trained to predict it.

### 3. `GET /api/fields`
Suggested response:
```json
{
  "fields": [
    {
      "rank": 1,
      "farm_id": "FARM_001",
      "plot_id": "PLOT_001_01",
      "crop_type": "Millet",
      "growth_stage": "Flowering",
      "risk_category": "Severe",
      "priority_score": 91,
      "main_contributor": "Soil_Moisture_Current_10cm_Pct"
    }
  ]
}
```
Return real field records/predictions only. Sort by priority score descending in the backend or frontend.

### 4. `GET /api/feature-importance`
Suggested response:
```json
{
  "features": [
    {"feature":"Soil_Moisture_Current_10cm_Pct","importance":0.21},
    {"feature":"Relative_Humidity_Pct","importance":0.12}
  ]
}
```
Values should come from the actual fitted model's `feature_importances_` (or a documented explainability method), not manually invented.

## Important model integration note
Your notebook uses `Current_Drought_Stress_Category` as the target and one-hot encodes the input features with `pd.get_dummies()`. It saves `random_forest_model.joblib` and `model_columns.joblib`. The FastAPI backend should load BOTH files, apply the same preprocessing, align input columns to the saved training columns (missing columns filled with 0), and then call `predict` / `predict_proba`. Keep the feature names and category spellings identical.

The dataset contains 9,184 rows, 8 crop types, and five target classes: Low, Moderate, High, Severe, Waterlogging Risk. The dashboard's category bars show the actual target-label counts from the uploaded CSV, not current live model predictions.

## Suggested priority criteria for your report
Define a transparent score with your team and state the formula. Example only:
- 60% predicted risk severity (map model class to a documented severity weight)
- 25% soil-moisture deficit relative to field capacity
- 15% crop-stage urgency (document stage weights)
Treat Waterlogging Risk separately: it should trigger drainage inspection, not an automatic "irrigate first" recommendation. Adjust weights only after discussing with your guide/domain expert.
