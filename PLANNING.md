# InSilicoVA vs TabICL Comparison Planning Document

## 1. Executive Summary

This document outlines the comprehensive plan for comparing InSilicoVA and TabICL models trained on PHMRC (child + neonate) data and evaluated on WHO2016 MITS data. The comparison will focus on individual prediction accuracy and Cause-Specific Mortality Fraction (CSMF) accuracy.

### Key Objectives
- Train both models on combined PHMRC child and neonate datasets
- Evaluate on MITS data (WHO2016 format)
- Compare individual COD accuracy and CSMF accuracy
- Document all data transformations and cause mappings

### Expected Outcomes
- Quantitative comparison of model performance
- Understanding of cross-format prediction capabilities
- Insights into strengths/weaknesses of each approach

## 2. Data Pipeline Architecture

### 2.1 Training Data (PHMRC Format)
- **Child Data**: `data/raw/PHMRC/IHME_PHMRC_VA_DATA_CHILD_Y2013M09D11_0.csv`
- **Neonate Data**: `data/raw/PHMRC/IHME_PHMRC_VA_DATA_NEONATE_Y2013M09D11_0.csv`
- **Label Column**: `gs_text34` (gold standard cause of death)
- **Symptom Columns**: g-prefixed columns (e.g., g5_0_1 through g5_07_14)
- **Administrative Columns**: g1-prefixed columns (to be dropped)

### 2.2 Test Data (WHO2016 Format)
- **MITS VA Data**: `data/raw/MITS/asr114_va2016.csv` (5,414 records × 536 columns)
- **MITS COD Labels**: `data/raw/MITS/asr_138_decode_results_classification.csv` (6,104 records × 108 columns)
- **Format**: WHO2016 symptom coding with Id10-prefixed columns
- **Label Columns**: 
  - Primary: `Underlying_Cause_calc` (ICD-10/ICD-11 codes, 512 unique causes)
  - Alternative: `UC_champs_group_desc` (CHAMPS groups, 55 unique cause groups)
- **Symptom Columns**: 467 Id10-prefixed columns (Id10002 to Id10481)
- **Linkage Key**: `champsid` (perfect match for all 5,414 VA records)
- **Administrative Columns to Exclude**: site_name, champsid, champs_deid, date_edit, deviceid, age_*, isAdult*, isChild*, isNeonatal*

### 2.3 Schema Reference
- **Mapping File**: `data/20250609_gs34_vs_UC_CHAMPS_desc[92].r`
- Contains cause grouping schemas and age-specific mappings

## 3. InSilicoVA Workflow

### 3.1 Docker Environment Setup
```dockerfile
# Existing Docker at models/insilico/Dockerfile
FROM rocker/r-ver:4.3.2
RUN install.packages(c("openVA", "InSilicoVA"))
```

### 3.2 Data Preparation
1. **Combine PHMRC datasets**: Merge child and neonate data with age group indicator
2. **Format conversion**: Use openVA with `data.type="phmrc"` for training data
3. **Symptom mapping**: Rely on openVA's internal PHMRC→WHO mapping

### 3.3 Model Training
```r
# Pseudo-code for InSilicoVA training
library(openVA)
library(InSilicoVA)

# Load and prepare PHMRC data
phmrc_data <- read.csv("combined_phmrc.csv")
phmrc_va <- ConvertData(phmrc_data, 
                        data.type = "phmrc",
                        data.coded = FALSE)

# Train InSilicoVA
insilico_model <- insilico(phmrc_va,
                           Nsim = 10000,
                           burnin = 5000,
                           auto.length = TRUE)
```

### 3.4 Prediction on MITS
```r
# Load WHO2016 MITS data and labels
mits_data <- read.csv("data/raw/MITS/asr114_va2016.csv")
mits_labels <- read.csv("data/raw/MITS/asr_138_decode_results_classification.csv")

# Merge VA data with COD labels on champsid
mits_combined <- merge(mits_data, mits_labels[,c("champsid", "Underlying_Cause_calc", "UC_champs_group_desc")], 
                       by = "champsid")

# Select Id10 columns for VA analysis
mits_va <- ConvertData(mits_combined[,grep("^Id10", names(mits_combined))],
                       data.type = "who2016",
                       data.coded = TRUE)

# Generate predictions
predictions <- predict(insilico_model, newdata = mits_va)
```

### 3.5 Output Extraction
- Individual predictions: Extract top cause for each case
- Probabilities: Full probability matrix for all causes
- CSMF: Population-level cause distribution

## 4. TabICL Workflow

### 4.1 Environment Setup
```python
# Requirements
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler
from tabicl import TabICLClassifier  # or similar
```

### 4.2 Data Preparation
1. **Load PHMRC data**: Read both child and neonate CSVs
2. **Feature engineering**: 
   - Select symptom columns (g-prefixed)
   - Handle missing values (imputation or indicators)
   - Encode categorical symptoms
3. **Label encoding**: Convert gs_text34 to numerical labels

### 4.3 Model Training
```python
# Pseudo-code for TabICL training
# Load and combine data
child_df = pd.read_csv("data/raw/PHMRC/IHME_PHMRC_VA_DATA_CHILD_Y2013M09D11_0.csv")
neonate_df = pd.read_csv("data/raw/PHMRC/IHME_PHMRC_VA_DATA_NEONATE_Y2013M09D11_0.csv")

# Combine with age indicator
child_df['age_group'] = 'child'
neonate_df['age_group'] = 'neonate'
combined_df = pd.concat([child_df, neonate_df])

# Prepare features and labels
X = combined_df.filter(regex='^g[0-9]')  # Symptom columns
y = combined_df['gs_text34']

# Initialize and train TabICL
model = TabICLClassifier(
    n_neighbors=10,
    temperature=0.1,
    max_context_size=100
)
model.fit(X, y)
```

### 4.4 Prediction on MITS
```python
# Load MITS VA data and COD labels
mits_df = pd.read_csv("data/raw/MITS/asr114_va2016.csv")
mits_labels = pd.read_csv("data/raw/MITS/asr_138_decode_results_classification.csv")

# Merge on champsid
mits_combined = mits_df.merge(mits_labels[['champsid', 'Underlying_Cause_calc', 'UC_champs_group_desc']], 
                              on='champsid')

# Select Id10 feature columns
id10_cols = [col for col in mits_combined.columns if col.startswith('Id10')]
X_test_raw = mits_combined[id10_cols]

# Map WHO2016 symptoms (Id10 columns) to PHMRC format (g-columns)
# This requires careful mapping of Id10XXX to g-prefixed columns
X_test = map_who2016_to_phmrc(X_test_raw)

# Generate predictions
predictions = model.predict(X_test)
probabilities = model.predict_proba(X_test)
```

### 4.5 Output Format
- Individual predictions: Class labels for each case
- Probabilities: Probability distribution over all causes
- CSMF: Aggregated cause distribution

## 5. Cause Mapping Strategy

### 5.1 PHMRC Cause Categories
Based on schema reference, PHMRC uses 34 standardized causes:
- **Neonates**: Birth asphyxia, Preterm delivery, Sepsis, etc.
- **Children**: Pneumonia, Diarrhea, Malaria, HIV/AIDS, etc.
- **Age-specific mapping**: Some causes only apply to certain age groups

### 5.2 WHO2016/MITS Cause Categories
- **Primary Classification**: ICD-10/ICD-11 codes (512 unique in `Underlying_Cause_calc`)
- **Grouped Classification**: CHAMPS groups (55 unique in `UC_champs_group_desc`)
  - Examples: "Sepsis", "Lower respiratory infections", "Neonatal preterm birth complications"
- **Age Categories**: Stillbirth, Early/Late Neonate, Infant, Child
- Requires mapping table to align ICD codes with PHMRC gs_text34 causes
- Handle unmappable causes by grouping into "Other"

### 5.3 Mapping Implementation
```python
# Two-level mapping strategy

# 1. Map ICD codes to CHAMPS groups (from MITS data)
icd_to_champs = {
    'J15.0': 'Lower respiratory infections',
    'P07.3': 'Neonatal preterm birth complications',
    'A04.8': 'Diarrhea/Dysentery',
    # ... complete mapping from asr_138_decode_results_classification.csv
}

# 2. Map CHAMPS groups to PHMRC gs_text34 categories
champs_to_phmrc = {
    'Lower respiratory infections': 'Pneumonia',
    'Diarrhea/Dysentery': 'Diarrhea/Dysentery', 
    'Malaria': 'Malaria',
    'Sepsis': 'Sepsis',
    'Neonatal preterm birth complications': 'Preterm Delivery',
    # ... complete mapping using schema reference
}

# Apply two-level mapping for comparison
df['champs_group'] = df['Underlying_Cause_calc'].map(icd_to_champs)
df['phmrc_cause'] = df['champs_group'].map(champs_to_phmrc)
```

## 6. Evaluation Framework

### 6.1 Individual Accuracy Metrics
- **Top-1 Accuracy**: Percentage of correctly predicted primary causes
- **Top-3 Accuracy**: Percentage where true cause is in top 3 predictions
- **Confusion Matrix**: Detailed cause-by-cause accuracy
- **Age-stratified Accuracy**: Separate metrics for neonates vs children

### 6.2 CSMF Accuracy
```python
def calculate_csmf_accuracy(true_csmf, pred_csmf):
    """Calculate CSMF accuracy (Murray et al. 2011)"""
    return 1 - sum(abs(true_csmf - pred_csmf)) / (2 * (1 - min(true_csmf)))
```

### 6.3 Additional Metrics
- **Chance-corrected concordance**: Adjust for random agreement
- **Cause-specific sensitivity/specificity**: Per-cause performance
- **Calibration plots**: Predicted vs actual probabilities

### 6.4 Statistical Testing
- **McNemar's test**: For paired accuracy comparison
- **Bootstrap confidence intervals**: For CSMF accuracy
- **Permutation tests**: For significance of differences

## 7. Technical Considerations

### 7.1 Computational Resources
- **InSilicoVA**: Docker container with 4GB RAM minimum
- **TabICL**: Python environment with scikit-learn, 8GB RAM recommended
- **Storage**: ~2GB for data and intermediate results

### 7.2 Reproducibility
- Set random seeds for both models
- Document all hyperparameters
- Version control for code and Docker images
- Save intermediate results for debugging

### 7.3 Platform Compatibility
- Docker must support the R container
- Python 3.8+ for TabICL
- Cross-platform file paths (use pathlib)

## 8. Risk Mitigation

### 8.1 Data Quality Risks
- **Missing data**: Implement robust imputation strategies (10 Id10 columns are completely empty in MITS)
- **Label noise**: Document known issues in PHMRC labels
- **Format inconsistencies**: Validate all data loads
- **Data linkage**: Ensure champsid matching between VA and COD files (690 COD-only cases exist)

### 8.2 Technical Risks
- **Docker failures**: Have fallback local R installation
- **Memory overflow**: Implement batch processing if needed
- **Convergence issues**: Monitor InSilicoVA MCMC diagnostics

### 8.3 Methodological Risks
- **Cause mapping ambiguity**: Document all decisions, sensitivity analysis
- **Population differences**: Note PHMRC vs MITS population characteristics
- **Model assumptions**: Document violations and impact

## 9. Implementation Timeline

### Phase 1: Data Preparation (Days 1-2)
- Load and explore all datasets
- Implement cause mapping
- Create combined training set

### Phase 2: InSilicoVA Pipeline (Days 3-4)
- Docker setup and testing
- Model training on PHMRC
- Prediction on MITS

### Phase 3: TabICL Pipeline (Days 5-6)
- Environment setup
- Feature engineering
- Model training and prediction

### Phase 4: Evaluation (Days 7-8)
- Calculate all metrics
- Statistical comparisons
- Generate visualizations

### Phase 5: Documentation (Day 9)
- Results summary
- Technical report
- Code documentation

## 10. Quality Assurance

### 10.1 Validation Checkpoints
1. **Data loading**: Verify row/column counts match expectations
2. **Cause mapping**: Manual review of 10% sample
3. **Model outputs**: Sanity check prediction distributions
4. **Metrics**: Compare with known benchmarks if available

### 10.2 Documentation Requirements
- All code must have docstrings
- Decision log for ambiguous choices
- README with reproduction instructions
- Results interpretation guide

### 10.3 Peer Review
- Code review for all major functions
- Statistical review of evaluation methods
- Domain expert review of cause mappings