# TODO List: InSilicoVA vs TabICL Comparison

## Task Status Indicators

- `[ ]` **Planned**: Task has been identified but work hasn't started
- `[~]` **In-Process**: Task is actively being worked on or PRP has been generated  
- `[x]` **Completed**: Task has been fully implemented, tested, and validated

Tasks should progress through these states:
1. **Planned** → **In-Process**: When PRP is generated or work begins
2. **In-Process** → **Completed**: When implementation passes all validation gates
3. If a task is blocked or paused, it remains **In-Process** with a note about the blocker

## 1. Data Preparation Tasks

### 1.1 Explore and Validate Datasets
- [ ] **[TASK-001]** Load and inspect PHMRC child dataset
  - Verify file path: `data/raw/PHMRC/IHME_PHMRC_VA_DATA_CHILD_Y2013M09D11_0.csv`
  - Check for gs_text34 column
  - Document number of cases and causes
  - **Complexity**: Low
  - **Dependencies**: None

- [ ] **[TASK-002]** Load and inspect PHMRC neonate dataset
  - Verify file path: `data/raw/PHMRC/IHME_PHMRC_VA_DATA_NEONATE_Y2013M09D11_0.csv`
  - Check for gs_text34 column
  - Document number of cases and causes
  - **Complexity**: Low
  - **Dependencies**: None

- [ ] **[TASK-003]** Load and inspect MITS WHO2016 dataset
  - Verify file path: `data/raw/MITS/asr114_va2016.csv`
  - Identify label column name
  - Document symptom column patterns (M-codes)
  - **Complexity**: Low
  - **Dependencies**: None

- [ ] **[TASK-004]** Analyze schema reference file
  - Load `data/20250609_gs34_vs_UC_CHAMPS_desc[92].r`
  - Extract cause mapping information
  - Document age-specific cause categories
  - **Complexity**: Medium
  - **Dependencies**: TASK-001, TASK-002, TASK-003

### 1.2 Data Combination and Preprocessing
- [ ] **[TASK-005]** Combine PHMRC child and neonate datasets
  - Add age_group indicator column
  - Handle column alignment issues
  - Save combined dataset
  - **Complexity**: Medium
  - **Dependencies**: TASK-001, TASK-002

- [ ] **[TASK-006]** Create symptom column mapping between PHMRC and WHO2016
  - Map g-prefixed columns to M-codes
  - Document unmappable symptoms
  - Create bidirectional mapping dictionary
  - **Complexity**: High
  - **Dependencies**: TASK-001, TASK-002, TASK-003

- [ ] **[TASK-007]** Create cause mapping between PHMRC and WHO2016/MITS
  - Map gs_text34 categories to MITS causes
  - Handle age-specific causes
  - Group unmappable causes
  - **Complexity**: High
  - **Dependencies**: TASK-004

## 2. InSilicoVA Pipeline Tasks

### 2.1 Docker Environment Setup
- [ ] **[TASK-008]** Review and update Dockerfile at `models/insilico/Dockerfile`
  - Ensure openVA and InSilicoVA packages are included
  - Add any missing R dependencies
  - Test Docker build
  - **Complexity**: Medium
  - **Dependencies**: None

- [ ] **[TASK-009]** Create R script for InSilicoVA training
  - Implement data loading with openVA
  - Configure InSilicoVA parameters
  - Add error handling
  - **Complexity**: Medium
  - **Dependencies**: TASK-008

### 2.2 InSilicoVA Model Training
- [ ] **[TASK-010]** Prepare PHMRC data for InSilicoVA
  - Convert to openVA format with data.type="phmrc"
  - Handle missing values
  - Validate conversion
  - **Complexity**: Medium
  - **Dependencies**: TASK-005, TASK-009

- [ ] **[TASK-011]** Train InSilicoVA on combined PHMRC data
  - Set MCMC parameters (Nsim=10000, burnin=5000)
  - Monitor convergence
  - Save trained model
  - **Complexity**: High
  - **Dependencies**: TASK-010

### 2.3 InSilicoVA Prediction
- [ ] **[TASK-012]** Prepare MITS data for InSilicoVA prediction
  - Convert to openVA format with data.type="who2016"
  - Apply symptom mappings if needed
  - Validate format
  - **Complexity**: Medium
  - **Dependencies**: TASK-003, TASK-006

- [ ] **[TASK-013]** Generate InSilicoVA predictions on MITS
  - Load trained model
  - Run predictions
  - Extract individual predictions and probabilities
  - **Complexity**: Medium
  - **Dependencies**: TASK-011, TASK-012

- [ ] **[TASK-014]** Calculate InSilicoVA CSMF
  - Aggregate individual predictions
  - Compute population-level cause distribution
  - Save results
  - **Complexity**: Low
  - **Dependencies**: TASK-013

## 3. TabICL Pipeline Tasks

### 3.1 TabICL Environment Setup
- [ ] **[TASK-015]** Set up Python environment with TabICL
  - Install tabicl package
  - Install required dependencies (pandas, sklearn, numpy)
  - Test imports
  - **Complexity**: Low
  - **Dependencies**: None

- [ ] **[TASK-016]** Create Python script for TabICL training
  - Implement data loading
  - Configure TabICL parameters
  - Add logging
  - **Complexity**: Medium
  - **Dependencies**: TASK-015

### 3.2 TabICL Data Preparation
- [ ] **[TASK-017]** Prepare PHMRC features for TabICL
  - Select symptom columns (g-prefixed)
  - Handle missing values
  - Encode categorical variables
  - **Complexity**: Medium
  - **Dependencies**: TASK-005

- [ ] **[TASK-018]** Encode PHMRC labels for TabICL
  - Convert gs_text34 to numerical labels
  - Create label mapping dictionary
  - Save encoder
  - **Complexity**: Low
  - **Dependencies**: TASK-017

### 3.3 TabICL Model Training
- [ ] **[TASK-019]** Train TabICL on combined PHMRC data
  - Configure hyperparameters (n_neighbors, temperature)
  - Fit model
  - Save trained model
  - **Complexity**: Medium
  - **Dependencies**: TASK-017, TASK-018

### 3.4 TabICL Prediction
- [ ] **[TASK-020]** Prepare MITS data for TabICL prediction
  - Apply symptom mappings from WHO2016 to PHMRC format
  - Handle missing columns
  - Validate feature alignment
  - **Complexity**: High
  - **Dependencies**: TASK-003, TASK-006

- [ ] **[TASK-021]** Generate TabICL predictions on MITS
  - Load trained model
  - Run predictions
  - Extract predictions and probabilities
  - **Complexity**: Medium
  - **Dependencies**: TASK-019, TASK-020

- [ ] **[TASK-022]** Calculate TabICL CSMF
  - Aggregate individual predictions
  - Compute population-level cause distribution
  - Save results
  - **Complexity**: Low
  - **Dependencies**: TASK-021

## 4. Evaluation Tasks

### 4.1 Individual Accuracy Metrics
- [ ] **[TASK-023]** Calculate top-1 accuracy for both models
  - Compare predictions to true labels
  - Compute overall and per-cause accuracy
  - **Complexity**: Medium
  - **Dependencies**: TASK-013, TASK-021

- [ ] **[TASK-024]** Calculate top-3 accuracy for both models
  - Check if true cause in top 3 predictions
  - Compare between models
  - **Complexity**: Medium
  - **Dependencies**: TASK-013, TASK-021

- [ ] **[TASK-025]** Generate confusion matrices
  - Create matrices for each model
  - Visualize results
  - **Complexity**: Medium
  - **Dependencies**: TASK-023

### 4.2 CSMF Metrics
- [ ] **[TASK-026]** Calculate CSMF accuracy for both models
  - Implement Murray et al. 2011 formula
  - Compare to true CSMF
  - **Complexity**: Medium
  - **Dependencies**: TASK-014, TASK-022

- [ ] **[TASK-027]** Compute cause-specific metrics
  - Sensitivity and specificity per cause
  - Positive predictive value
  - **Complexity**: Medium
  - **Dependencies**: TASK-023

### 4.3 Statistical Comparison
- [ ] **[TASK-028]** Perform statistical tests
  - McNemar's test for paired accuracy
  - Bootstrap confidence intervals
  - Document significance levels
  - **Complexity**: High
  - **Dependencies**: TASK-023, TASK-026

## 5. Visualization and Reporting Tasks

- [ ] **[TASK-029]** Create comparison visualizations
  - Accuracy bar charts
  - CSMF comparison plots
  - Confusion matrix heatmaps
  - **Complexity**: Medium
  - **Dependencies**: TASK-023 to TASK-028

- [ ] **[TASK-030]** Generate results summary table
  - All metrics for both models
  - Statistical test results
  - Key findings
  - **Complexity**: Low
  - **Dependencies**: TASK-023 to TASK-028

- [ ] **[TASK-031]** Write technical report
  - Methods description
  - Results interpretation
  - Limitations and recommendations
  - **Complexity**: Medium
  - **Dependencies**: TASK-001 to TASK-030

## 6. Quality Assurance Tasks

- [ ] **[TASK-032]** Validate data pipeline
  - Check row counts at each step
  - Verify cause mappings with samples
  - Test edge cases
  - **Complexity**: Medium
  - **Dependencies**: TASK-001 to TASK-022

- [ ] **[TASK-033]** Code review and documentation
  - Add docstrings to all functions
  - Create README with instructions
  - Document decision rationale
  - **Complexity**: Low
  - **Dependencies**: TASK-001 to TASK-031

- [ ] **[TASK-034]** Reproducibility check
  - Test full pipeline from scratch
  - Verify results consistency
  - Document any issues
  - **Complexity**: High
  - **Dependencies**: TASK-001 to TASK-034

## Task Execution Order

### Priority 1 (Foundation)
1. TASK-001 to TASK-004 (Data exploration)
2. TASK-005 to TASK-007 (Data preparation)
3. TASK-008, TASK-015 (Environment setup)

### Priority 2 (Model Implementation)
4. TASK-009 to TASK-014 (InSilicoVA pipeline)
5. TASK-016 to TASK-022 (TabICL pipeline)

### Priority 3 (Evaluation)
6. TASK-023 to TASK-028 (Metrics calculation)
7. TASK-029 to TASK-031 (Visualization and Reporting)

### Priority 4 (Documentation)
8. TASK-032 to TASK-034 (Quality assurance)

## Notes
- Dependencies indicate which tasks must be completed first
- Save all intermediate results for debugging and validation