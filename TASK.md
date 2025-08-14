# TODO List: InSilicoVA vs TabICL Comparison

## 1. Data Preparation Tasks

### 1.1 Explore and Validate Datasets
- [ ] Load and inspect PHMRC child dataset
  - Verify file path: `data/raw/PHMRC/IHME_PHMRC_VA_DATA_CHILD_Y2013M09D11_0.csv`
  - Check for gs_text34 column
  - Document number of cases and causes
  - **Complexity**: Low
  - **Dependencies**: None

- [ ] Load and inspect PHMRC neonate dataset
  - Verify file path: `data/raw/PHMRC/IHME_PHMRC_VA_DATA_NEONATE_Y2013M09D11_0.csv`
  - Check for gs_text34 column
  - Document number of cases and causes
  - **Complexity**: Low
  - **Dependencies**: None

- [ ] Load and inspect MITS WHO2016 dataset
  - Verify file path: `data/raw/MITS/asr114_va2016.csv`
  - Identify label column name
  - Document symptom column patterns (M-codes)
  - **Complexity**: Low
  - **Dependencies**: None

- [ ] Analyze schema reference file
  - Load `data/20250609_gs34_vs_UC_CHAMPS_desc[92].r`
  - Extract cause mapping information
  - Document age-specific cause categories
  - **Complexity**: Medium
  - **Dependencies**: Task 1.1, 1.2, 1.3

### 1.2 Data Combination and Preprocessing
- [ ] Combine PHMRC child and neonate datasets
  - Add age_group indicator column
  - Handle column alignment issues
  - Save combined dataset
  - **Complexity**: Medium
  - **Dependencies**: Tasks 1.1, 1.2

- [ ] Create symptom column mapping between PHMRC and WHO2016
  - Map g-prefixed columns to M-codes
  - Document unmappable symptoms
  - Create bidirectional mapping dictionary
  - **Complexity**: High
  - **Dependencies**: Tasks 1.1, 1.2, 1.3

- [ ] Create cause mapping between PHMRC and WHO2016/MITS
  - Map gs_text34 categories to MITS causes
  - Handle age-specific causes
  - Group unmappable causes
  - **Complexity**: High
  - **Dependencies**: Task 1.4

## 2. InSilicoVA Pipeline Tasks

### 2.1 Docker Environment Setup
- [ ] Review and update Dockerfile at `models/insilico/Dockerfile`
  - Ensure openVA and InSilicoVA packages are included
  - Add any missing R dependencies
  - Test Docker build
  - **Complexity**: Medium
  - **Dependencies**: None

- [ ] Create R script for InSilicoVA training
  - Implement data loading with openVA
  - Configure InSilicoVA parameters
  - Add error handling
  - **Complexity**: Medium
  - **Dependencies**: Task 2.1

### 2.2 InSilicoVA Model Training
- [ ] Prepare PHMRC data for InSilicoVA
  - Convert to openVA format with data.type="phmrc"
  - Handle missing values
  - Validate conversion
  - **Complexity**: Medium
  - **Dependencies**: Tasks 1.5, 2.2

- [ ] Train InSilicoVA on combined PHMRC data
  - Set MCMC parameters (Nsim=10000, burnin=5000)
  - Monitor convergence
  - Save trained model
  - **Complexity**: High
  - **Dependencies**: Task 2.3

### 2.3 InSilicoVA Prediction
- [ ] Prepare MITS data for InSilicoVA prediction
  - Convert to openVA format with data.type="who2016"
  - Apply symptom mappings if needed
  - Validate format
  - **Complexity**: Medium
  - **Dependencies**: Tasks 1.3, 1.6

- [ ] Generate InSilicoVA predictions on MITS
  - Load trained model
  - Run predictions
  - Extract individual predictions and probabilities
  - **Complexity**: Medium
  - **Dependencies**: Tasks 2.4, 2.5

- [ ] Calculate InSilicoVA CSMF
  - Aggregate individual predictions
  - Compute population-level cause distribution
  - Save results
  - **Complexity**: Low
  - **Dependencies**: Task 2.6

## 3. TabICL Pipeline Tasks

### 3.1 TabICL Environment Setup
- [ ] Set up Python environment with TabICL
  - Install tabicl package
  - Install required dependencies (pandas, sklearn, numpy)
  - Test imports
  - **Complexity**: Low
  - **Dependencies**: None

- [ ] Create Python script for TabICL training
  - Implement data loading
  - Configure TabICL parameters
  - Add logging
  - **Complexity**: Medium
  - **Dependencies**: Task 3.1

### 3.2 TabICL Data Preparation
- [ ] Prepare PHMRC features for TabICL
  - Select symptom columns (g-prefixed)
  - Handle missing values
  - Encode categorical variables
  - **Complexity**: Medium
  - **Dependencies**: Task 1.5

- [ ] Encode PHMRC labels for TabICL
  - Convert gs_text34 to numerical labels
  - Create label mapping dictionary
  - Save encoder
  - **Complexity**: Low
  - **Dependencies**: Task 3.3

### 3.3 TabICL Model Training
- [ ] Train TabICL on combined PHMRC data
  - Configure hyperparameters (n_neighbors, temperature)
  - Fit model
  - Save trained model
  - **Complexity**: Medium
  - **Dependencies**: Tasks 3.3, 3.4

### 3.4 TabICL Prediction
- [ ] Prepare MITS data for TabICL prediction
  - Apply symptom mappings from WHO2016 to PHMRC format
  - Handle missing columns
  - Validate feature alignment
  - **Complexity**: High
  - **Dependencies**: Tasks 1.3, 1.6

- [ ] Generate TabICL predictions on MITS
  - Load trained model
  - Run predictions
  - Extract predictions and probabilities
  - **Complexity**: Medium
  - **Dependencies**: Tasks 3.5, 3.6

- [ ] Calculate TabICL CSMF
  - Aggregate individual predictions
  - Compute population-level cause distribution
  - Save results
  - **Complexity**: Low
  - **Dependencies**: Task 3.7

## 4. Evaluation Tasks

### 4.1 Individual Accuracy Metrics
- [ ] Calculate top-1 accuracy for both models
  - Compare predictions to true labels
  - Compute overall and per-cause accuracy
  - **Complexity**: Medium
  - **Dependencies**: Tasks 2.6, 3.7

- [ ] Calculate top-3 accuracy for both models
  - Check if true cause in top 3 predictions
  - Compare between models
  - **Complexity**: Medium
  - **Dependencies**: Tasks 2.6, 3.7

- [ ] Generate confusion matrices
  - Create matrices for each model
  - Visualize results
  - **Complexity**: Medium
  - **Dependencies**: Task 4.1

### 4.2 CSMF Metrics
- [ ] Calculate CSMF accuracy for both models
  - Implement Murray et al. 2011 formula
  - Compare to true CSMF
  - **Complexity**: Medium
  - **Dependencies**: Tasks 2.7, 3.8

- [ ] Compute cause-specific metrics
  - Sensitivity and specificity per cause
  - Positive predictive value
  - **Complexity**: Medium
  - **Dependencies**: Task 4.1

### 4.3 Statistical Comparison
- [ ] Perform statistical tests
  - McNemar's test for paired accuracy
  - Bootstrap confidence intervals
  - Document significance levels
  - **Complexity**: High
  - **Dependencies**: Tasks 4.1, 4.4

## 5. Visualization and Reporting Tasks

- [ ] Create comparison visualizations
  - Accuracy bar charts
  - CSMF comparison plots
  - Confusion matrix heatmaps
  - **Complexity**: Medium
  - **Dependencies**: Section 4 tasks

- [ ] Generate results summary table
  - All metrics for both models
  - Statistical test results
  - Key findings
  - **Complexity**: Low
  - **Dependencies**: Section 4 tasks

- [ ] Write technical report
  - Methods description
  - Results interpretation
  - Limitations and recommendations
  - **Complexity**: Medium
  - **Dependencies**: All previous tasks

## 6. Quality Assurance Tasks

- [ ] Validate data pipeline
  - Check row counts at each step
  - Verify cause mappings with samples
  - Test edge cases
  - **Complexity**: Medium
  - **Dependencies**: Sections 1-3 tasks

- [ ] Code review and documentation
  - Add docstrings to all functions
  - Create README with instructions
  - Document decision rationale
  - **Complexity**: Low
  - **Dependencies**: All code tasks

- [ ] Reproducibility check
  - Test full pipeline from scratch
  - Verify results consistency
  - Document any issues
  - **Complexity**: High
  - **Dependencies**: All tasks

## Task Execution Order

### Priority 1 (Foundation)
1. Tasks 1.1-1.4 (Data exploration)
2. Tasks 1.5-1.7 (Data preparation)
3. Tasks 2.1, 3.1 (Environment setup)

### Priority 2 (Model Implementation)
4. Tasks 2.2-2.7 (InSilicoVA pipeline)
5. Tasks 3.2-3.8 (TabICL pipeline)

### Priority 3 (Evaluation)
6. Tasks 4.1-4.6 (Metrics calculation)
7. Tasks 5.1-5.3 (Visualization)

### Priority 4 (Documentation)
8. Tasks 6.1-6.3 (Quality assurance)

## Notes
- All tasks marked as incomplete (unchecked)
- Dependencies indicate which tasks must be completed first
- Complexity ratings: Low (< 2 hours), Medium (2-4 hours), High (> 4 hours)
- Save all intermediate results for debugging and validation