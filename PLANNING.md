# InSilicoVA vs TabICL Comparison Planning Document

## 1. Executive Summary

This document outlines the comprehensive plan for comparing InSilicoVA and TabICL models on Verbal Autopsy data. The comparison will focus on individual prediction accuracy and Cause-Specific Mortality Fraction (CSMF) accuracy.

### Key Objectives
- Evaluate on CHAMP VA data (WHO2016 format)
- Compare individual COD accuracy and CSMF accuracy
- Document all data transformations and cause mappings

### Expected Outcomes
- Quantitative comparison of model performance
- Understanding of cross-format prediction capabilities
- Insights into strengths/weaknesses of each approach

## 2. Data Pipeline Architecture



### 2.2 VA Data (WHO2016 Format)
- **MITS VA Data**: `data/raw/MITS/asr114_va2016.csv` (5,414 records × 536 columns)




## 3. InSilicoVA Workflow

### 3.1 Docker Environment Setup
```dockerfile
# Existing Docker at Dockerfile
FROM rocker/r-ver:4.3.2
RUN install.packages(c("openVA", "InSilicoVA"))
```

### 3.2 Data Preparation



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
ls

### 4.3 Model Training


### 4.4 Prediction on MITS


### 4.5 Output Format
- Individual predictions: Class labels for each case
- Probabilities: Probability distribution over all causes
- CSMF: Aggregated cause distribution
