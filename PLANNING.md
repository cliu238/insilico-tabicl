# InSilicoVA Error Matrix Pipeline - Planning Document

## Project Overview

**Goal**: Create a simplified, reproducible R pipeline that replicates the InSilicoVA error matrix generation from raw verbal autopsy data to the final error matrix plot, specifically achieving the exact "ALL (n=2057)" result shown in the original analysis.

**Target Output**: Error matrix plot matching `cod_heterogeneity_results/20241004_error_matrices_heterogeneity_child/single_child_insilicova_error_mats.png` (first matrix only)

## Architecture

### Pipeline Flow
```
Raw VA/MITS Data → Data Merging → InSilicoVA Training → Probability Extraction → 
Cause Mapping → Single Cause Assignment → Error Matrix → Visualization
```

### Directory Structure
```
insilico-tabicl/
├── data/
│   ├── raw/                     # Raw VA and MITS CSV files
│   └── processed/               # Intermediate RDS files
├── src/
│   ├── 01_data_prep.R          # Data loading and merging
│   ├── 02_train_insilico.R     # InSilicoVA model training
│   ├── 03_extract_probs.R      # Probability extraction
│   ├── 04_cause_mapping.R      # Map to broad causes
│   ├── 05_single_cause.R       # Convert to single cause
│   ├── 06_error_matrix.R       # Generate error matrix
│   └── utils.R                 # Helper functions
├── results/
│   ├── models/                 # Saved InSilicoVA models
│   ├── probabilities/          # Probability matrices
│   └── plots/                  # Final error matrix plots
├── tests/
│   └── test_pipeline.R
├── run_pipeline.R              # Main execution script
├── Dockerfile                  # Docker environment
├── PLANNING.md                 # This file
├── TASK.md                     # Task tracking
└── README.md                   # Documentation
```

## Technical Specifications

### Dependencies
- **R Version**: 4.x (as per Dockerfile)
- **Key R Packages**:
  - `openVA`: Core VA analysis framework
  - `InSilicoVA`: Bayesian VA algorithm
  - `tidyverse`: Data manipulation
  - `ggplot2`: Visualization
  - `reshape2`: Data reshaping

### Data Requirements
- **VA Data**: WHO 2016 format CSV (`asr114_va2016.csv`)
- **MITS Data**: Gold standard classifications (`asr_138_decode_results_classification.csv`)
- **Key Identifier**: `champs_deid` for matching VA-MITS records

## Implementation Stages

### Stage 1: Data Preparation
**Goal**: Load and merge VA/MITS data for child age group
**Success Criteria**: 
- Successfully load both datasets
- Merge on `champs_deid` identifier
- Filter for child age group (Infant, Child)
- Verify n=2057 cases for "ALL" group

### Stage 2: InSilicoVA Training
**Goal**: Train single InSilicoVA model on all child data
**Success Criteria**:
- Model converges with Nsim=10000
- Uses WHO2016 data format
- Produces probability distributions

### Stage 3: Probability Processing
**Goal**: Extract and normalize individual probabilities
**Success Criteria**:
- Extract probability matrix (individuals × causes)
- Normalize to sum to 1 per individual
- Handle zero probabilities (set to 0.0000001)

### Stage 4: Cause Mapping
**Goal**: Map WHO causes to broad categories
**Success Criteria**:
- Define 8 broad cause categories:
  - malaria
  - pneumonia
  - diarrhea
  - severe_malnutrition
  - hiv
  - injury
  - other_infections
  - nn_causes
- Aggregate probabilities by broad cause

### Stage 5: Single Cause Assignment
**Goal**: Convert probabilities to single predicted cause
**Success Criteria**:
- Select maximum probability cause per individual
- Create binary prediction matrix

### Stage 6: Error Matrix Generation
**Goal**: Calculate confusion matrix between predictions and MITS
**Success Criteria**:
- Matrix dimensions: causes × causes
- Row normalization for proportions
- Include sample sizes in labels

### Stage 7: Visualization
**Goal**: Create error matrix heatmap
**Success Criteria**:
- Matches original plot style
- Red gradient (0-100%)
- Percentage labels in cells
- Title shows "All (n=2057)"

## Testing Strategy

### Unit Tests
- Test data loading functions
- Test cause mapping logic
- Test probability normalization
- Test single cause selection

### Integration Tests
- End-to-end pipeline execution
- Reproducibility with seed=123
- Docker environment validation

### Validation
- Compare intermediate outputs with original pipeline
- Verify final error matrix values
- Visual comparison with target plot

## Docker Deployment

### Build Process
```bash
docker build -t insilico-pipeline .
```

### Run Process
```bash
docker run -v $(pwd):/data insilico-pipeline Rscript run_pipeline.R
```

### Verification
- Check that all R packages load correctly
- Verify Java configuration for rJava
- Test InSilicoVA model execution

## Key Design Decisions

### Simplifications from Original
1. **Single Model**: Train one model on all sites instead of site-specific models
2. **Direct Processing**: Skip intermediate COMSA alignment steps
3. **Focused Output**: Generate only the "ALL" aggregate plot
4. **Streamlined Code**: Consolidate 8+ scripts into 6 modular components

### Maintained Complexity
1. **Exact Cause Mappings**: Preserve all cause category definitions
2. **Probability Processing**: Keep normalization and zero-handling logic
3. **MITS Alignment**: Maintain proper VA-MITS matching
4. **Visualization Style**: Replicate exact plot formatting

## Success Metrics

1. **Data Integrity**:
   - Input: 2057 child cases with both VA and MITS data
   - Output: Complete error matrix with all cause categories

2. **Model Performance**:
   - InSilicoVA convergence within 10000 iterations
   - Stable probability distributions

3. **Result Accuracy**:
   - Error matrix values match original to within 1%
   - Visual plot identical to reference image

4. **Reproducibility**:
   - Same results with seed=123
   - Consistent outputs in Docker environment
   - Pipeline completes in < 30 minutes

## Risk Mitigation

### Potential Issues
1. **Data Access**: Raw data files may not be present
   - Mitigation: Create synthetic test data matching format
   
2. **Package Versions**: R package compatibility issues
   - Mitigation: Pin exact versions in Docker
   
3. **Memory Requirements**: InSilicoVA with 10000 iterations
   - Mitigation: Adjust Docker memory limits
   
4. **Cause Mapping Discrepancies**: Different cause lists between VA/MITS
   - Mitigation: Implement robust matching with warnings

## Code Style Guidelines

### R Conventions
- Use tidyverse style guide
- Function names: snake_case
- Variable names: descriptive_lowercase
- Comments: Explain why, not what
- Error handling: Explicit checks with informative messages

### Documentation
- Each function has roxygen2 documentation
- Pipeline steps logged to console
- Results include metadata (timestamp, parameters)

## Monitoring & Logging

### Progress Indicators
```r
message("Stage 1/7: Loading data...")
message(sprintf("  - Loaded %d VA records", nrow(va_data)))
```

### Checkpoints
- Save intermediate results after each stage
- Enable restart from any checkpoint
- Log file with timestamps and status

## Next Steps

1. Set up directory structure
2. Implement Stage 1 (Data Preparation)
3. Verify data dimensions match expected
4. Proceed through stages sequentially
5. Compare outputs at each stage
6. Fine-tune until exact match achieved

## Constraints

- **Exact Reproducibility**: Must match original error matrix values
- **Docker Compatibility**: All code must run in provided Dockerfile environment
- **No External Dependencies**: Use only packages in Dockerfile
- **Modular Design**: Each stage independently testable
- **Clear Documentation**: Code understandable to VA researchers

## References

- Original Pipeline: `insilicova_pipeline_trace.md`
- Target Output: `single_child_insilicova_error_mats.png`
- InSilicoVA Documentation: CRAN package documentation
- WHO 2016 VA Format: WHO verbal autopsy standards