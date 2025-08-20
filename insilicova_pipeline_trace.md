# InSilicoVA Error Matrix Pipeline Trace

## Overview
This document traces the complete data pipeline from raw verbal autopsy data to the final InSilicoVA error matrix plot located at:
`cod_heterogeneity_results/20241004_error_matrices_heterogeneity_child/single_child_insilicova_error_mats.png`

## Pipeline Summary
```
Raw VA/MITS Data → InSilicoVA Model → Probabilities → Single Cause → Error Matrix → Plot
```

---

## Stage 1: Raw Data Sources

### Input Files
- **VA Data**: `/Data/CHAMPS_MITS_VA_20240318/ASR-138_JHU_MITS_VA_V3/asr114_va2016.csv`
- **MITS Data** (Gold Standard): `/Data/CHAMPS_MITS_VA_20240318/ASR-138_JHU_MITS_VA_V3/asr_138_decode_results_classification.csv`

### Description
- VA data contains verbal autopsy survey responses
- MITS data contains the gold standard cause of death classifications from minimally invasive tissue sampling
- These are matched by `champs_deid` identifier

---

## Stage 2: Data Processing & Model Training
**Script**: `Raw_to_CalibratedVA_input_pipeline/Code/03. CHAMPS openVA results.R`

### Key Operations
1. **Data Loading and Merging**:
```r
# Load VA data
CHAMPSVAdata <- read.csv(".../asr114_va2016.csv", header=TRUE, stringsAsFactors=FALSE)

# Load MITS data
CHAMPSMITSdata <- read.csv(".../asr_138_decode_results_classification.csv", header=TRUE, stringsAsFactors=FALSE)

# Merge VA with MITS to get only matched cases
VA_MITS <- merge(CHAMPSdata, CHAMPSMITSdata[,c("Name","champs_deid")], by=c("champs_deid"))
```

2. **Age Group Splitting** (Line 759-762):
```r
# Split by age groups
IV5data.neonatal <- subset(CHAMPSdata, age_group_desc %in% 
    c("Death in the first 24 hours","Early Neonate (1 to 6 days)","Late Neonate (7 to 27 days)"))
    
IV5data.childu5 <- subset(CHAMPSdata, age_group_desc %in% c("Child","Infant"))
```

3. **Site-Specific Data Preparation** (Line 813-814):
```r
# Split by country/site
IV5childu5_Bang <- subset(IV5childu5_all, Name %in% c("Bangladesh"))
IV5childu5_Eth <- subset(IV5childu5_all, Name %in% c("Ethiopia"))
# ... continues for Kenya, Malawi, Mozambique, Sierra Leone, South Africa
```

4. **InSilicoVA Model Training** (Line 926-945):
```r
# Run InSilicoVA for each site - Child age group
set.seed(123)
Insilico.child.Bang <- codeVA(IV5childu5_Bang, data.type="WHO2016", model="InSilicoVA",
                              Nsim=10000, version="5.0")
                              
Insilico.child.Eth <- codeVA(IV5childu5_Eth, data.type="WHO2016", model="InSilicoVA",
                             Nsim=10000, version="5.0")
# ... continues for other sites

# Save all model outputs
save.image(file=file.path(file,"/Data/openVA_champs.Rdata"))
```

### Output
- **File**: `Data/openVA_champs.Rdata`
- Contains trained InSilicoVA model objects for each site and age group

---

## Stage 3: Probability Extraction and Cause Mapping
**Script**: `Raw_to_CalibratedVA_input_pipeline/Code/06c. multi_va_champs.R`

### Key Operations
1. **Load Model Results** (Line 11):
```r
load(file.path(file,"Data/openVA_champs.Rdata"))
```

2. **Extract Individual Probabilities** (Line 61-71):
```r
# Extract probabilities for each site - Child
insilico_probs_child_Bang <- getIndivProb(Insilico.child.Bang)
insilico_probs_child_Eth <- getIndivProb(Insilico.child.Eth)
# ... continues for other sites

# Combine all sites
insilico_probs_child <- rbind(insilico_probs_child_Bang, insilico_probs_child_Eth,
                              insilico_probs_child_Ken, insilico_probs_child_Mal,
                              insilico_probs_child_Moz, insilico_probs_child_SL,
                              insilico_probs_child_SA)

# Normalize probabilities
insilico_probs_child[insilico_probs_child == 0] <- .0000001
insilico_probs_child <- t(apply(insilico_probs_child, 1, function(x) (x/sum(x))))
```

3. **Cause Category Mapping** (Line 179-271):
```r
# Define cause mappings for child age group
malaria <- c("Malaria")
pneumonia <- c("Acute resp infect incl pneumonia","Neonatal pneumonia")
diarrhea <- c("Diarrhoeal diseases")
severe_malnutrition <- c("Severe malnutrition")
hiv <- c("HIV/AIDS related death")
injury <- c("Accid drowning and submersion", "Accid fall", "Assault", ...)
other_infections <- c("Dengue fever", "Measles", "Meningitis and encephalitis", ...)
nn_causes <- c("Congenital malformation","Birth asphyxia","Prematurity")

# Create mapping dataframe
cause_map_child <- data.frame(
    causes = c(malaria, pneumonia, diarrhea, ...),
    broad_cause = rep(c("malaria", "pneumonia", "diarrhea", ...), ...)
)
```

4. **Apply Cause Mapping** (Line 324-335):
```r
# Map individual causes to broad groups
model_broad_probs.InsilicoVA.child <- insilico_probs_child
colnames(model_broad_probs.InsilicoVA.child) <- 
    cause_map_child$broad_cause[match(colnames(model_broad_probs.InsilicoVA.child),
                                      cause_map_child$causes)]

# Aggregate probabilities by broad cause
mn <- model.matrix(~ colnames(model_broad_probs.InsilicoVA.child) + 0)
model_broad_probs.InsilicoVA.child <- model_broad_probs.InsilicoVA.child %*% mn
```

### Output
- **File**: `Results/multi_insilicova_child_champs.rds`
- Contains probability distributions across broad cause categories for each individual

---

## Stage 4: Single Cause Assignment
**Script**: `Raw_to_CalibratedVA_input_pipeline/Code/07. multi_to_single_VA.R`

### Key Operations
1. **Convert Probabilities to Single Cause** (Line 100-102):
```r
# Load multi-cause probabilities
model_broad_probs.InsilicoVA.child.CHAMPS <- 
    readRDS("Results/multi_insilicova_child_champs.rds")

# Select maximum probability cause for each individual
single_cause_probs.InsilicoVA.child.CHAMPS <- 
    t(apply(model_broad_probs.InsilicoVA.child.CHAMPS, 1, 
            function(x) as.numeric(x == max(x))))
            
# Preserve column names
colnames(single_cause_probs.InsilicoVA.child.CHAMPS) <- 
    colnames(model_broad_probs.InsilicoVA.child.CHAMPS)
```

### Output
- **File**: `Results/single_insilicova_child_champs.rds`
- Binary matrix where each row is an individual and columns are causes (1 = predicted cause, 0 = not predicted)

---

## Stage 5: Data Alignment
**Script**: `Raw_to_CalibratedVA_input_pipeline/Code/08a. match mits-va and format.R`

### Key Operations
1. **Ensure Consistent Row Ordering** (Line 55-77):
```r
# Read single cause predictions
single_insilicova_child_comsa <- readRDS("Results/single_insilicova_child_comsa.rds")
single_interva_child_comsa <- readRDS("Results/single_interva_child_comsa.rds")
single_eava_child_comsa <- readRDS("Results/single_eava_child_comsa.rds")

# Find intersection of cases across methods
intersection_comsa <- merge(single_interva_child_comsa, single_eava_child_comsa, 
                           by="row.names")
rownames <- intersection_comsa[,c("Row.names")]

# Align all methods to same row order
single_insilicova_child_comsa <- 
    single_insilicova_child_comsa[match(rownames, 
                                        rownames(single_insilicova_child_comsa)), ]
```

2. **Save to Dated Folder** (Line 88):
```r
date <- "20241004_comsa_data"
saveRDS(single_insilicova_child_comsa, 
        file=paste0("Results/",date,"/single_insilicova_child_comsa.rds"))
```

---

## Stage 6: Site Assignment
**Script**: `Raw_to_CalibratedVA_input_pipeline/Code/8d. add site after untie.R`

### Key Operations
- Adds site information (Bangladesh, Ethiopia, Kenya, etc.) to each case
- Creates separate files for CHAMPS (predictions) and MITS (ground truth)

### Output Location
- `cod_heterogeneity_results/20241004_comsa_data_site/`
  - `single_insilicova_child_champs.rds` (InSilicoVA predictions)
  - `single_mits_child_champs.rds` (MITS ground truth)

---

## Stage 7: Error Matrix Generation and Plotting
**Script**: `cod_heterogeneity_results/error_matrix_heterogeneity_insilicova_interva_child.R`

### Key Operations
1. **Load Final Data** (Line 46-48):
```r
# Load predictions and ground truth
champs <- readRDS(file.path(data_dir[[cohort]], 
                  paste0(type, '_', method, '_', cohort, '_champs.rds')))
                  
mits <- readRDS(file.path(data_dir[[cohort]], 
                paste0(type, '_mits_', cohort, '_champs.rds'))) %>%
                tibble::rownames_to_column("id")
```

2. **Calculate Error Matrix** (Line 75-79):
```r
# Calculate confusion matrix
error = as.matrix(t(mits_sub[,causes[[cohort]]])) %*% 
        as.matrix(champs_sub[,causes[[cohort]]])

# Normalize by row sums to get proportions
error = error/rowSums(error)

# Add sample sizes to row names
rownames(error) <- paste0(causes[[cohort]], " (", 
                          colSums(mits_sub %>% select(-c(site,id))), ")")
```

3. **Create Visualization** (Line 85-94):
```r
# Create heatmap plot
plot_error <- ggplot(data = melt(error), 
                     aes(x=Var2, y=factor(Var1,levels=rev(rownames(error))), 
                         fill=value)) + 
    geom_tile() +
    scale_fill_gradient2(low = "white", high = "red", 
                        breaks=seq(0,1,0.2), limits = c(0,1), 
                        labels=scales::percent) +
    theme(axis.text.x = element_text(angle=45,hjust=1)) +
    ylab(paste0(type, '-cause MITS')) +
    xlab("VA") +
    ggtitle(paste0(method, " error matrix: ", c, " (n=", nrow(mits_sub), ")"))

# Add percentage labels
plot_error + geom_text(aes(label=paste0(round(100*value),"%")), size=3)
```

4. **Save Plot** (Line 110):
```r
ggsave(error, 
       file=file.path(output_dir, 
                     paste0(type, '_', cohort,'_', method, "_error_mats.png")),
       width=12, height=15)
```

### Final Output
- **File**: `cod_heterogeneity_results/20241004_error_matrices_heterogeneity_child/single_child_insilicova_error_mats.png`
- Contains error matrices for each site and an aggregate "All (n=1203)" plot

---

## Error Matrix Interpretation

The error matrix (confusion matrix) shows:
- **Rows**: True causes from MITS (gold standard)
- **Columns**: Predicted causes from InSilicoVA
- **Diagonal**: Correct predictions (higher percentages = better performance)
- **Off-diagonal**: Misclassifications (shows which causes are confused with each other)
- **Color scale**: White (0%) to Red (100%) indicating prediction accuracy

The "All (n=1203)" plot aggregates performance across all sites, showing overall InSilicoVA accuracy for child mortality cause prediction.

---

## Key Insights

1. **Multi-Site Training**: InSilicoVA models are trained separately for each site to account for regional variations in cause patterns
2. **Cause Aggregation**: Individual WHO causes are mapped to broader categories for clearer analysis
3. **Probability to Classification**: Multi-cause probabilities are converted to single causes using maximum probability
4. **Validation Against Gold Standard**: MITS provides the ground truth for evaluating VA algorithm performance
5. **Visual Performance Assessment**: Error matrices provide intuitive visualization of algorithm strengths and weaknesses