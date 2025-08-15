name: "TASK-001 PHMRC Child Dataset Exploration"
description: |

## Purpose
Comprehensive exploration and validation of the PHMRC child dataset to understand its structure, verify data integrity, and document key characteristics for VA model training.

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
Explore and validate the PHMRC child dataset to understand its structure, content, and readiness for VA model training. Document the dataset characteristics including number of cases, causes of death distribution, symptom columns, and any data quality issues.

## Why
- **Foundation for VA comparison**: This is the first critical step in the InSilicoVA vs TabICL comparison project
- **Data quality assurance**: Ensure data integrity before model training
- **Feature identification**: Identify which columns are symptoms vs administrative metadata
- **Cause distribution**: Document the distribution of causes of death (gs_text34)
- **Baseline documentation**: Create reference documentation for subsequent tasks

## What
Create a comprehensive data exploration script that:
- Loads the PHMRC child dataset successfully
- Verifies the existence and content of the gs_text34 column
- Identifies symptom columns (g-prefixed) vs administrative columns
- Documents dataset statistics and characteristics
- Saves exploration results for reference

### Success Criteria
- [ ] Successfully load the dataset without errors
- [ ] Verify gs_text34 column exists with valid cause of death labels
- [ ] Document exact number of cases and causes
- [ ] Identify all symptom columns (g-prefixed patterns)
- [ ] Identify columns to be dropped (administrative/metadata)
- [ ] Generate comprehensive statistical summary
- [ ] Save exploration results to data_exploration directory

## All Needed Context

### Documentation & References (list all context needed to implement the feature)
```yaml
# MUST READ - Include these in your context window
- url: https://pandas.pydata.org/docs/reference/api/pandas.read_csv.html
  why: Core method for loading CSV data with proper dtype handling
  
- url: https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.info.html
  why: Essential for understanding dataframe structure and dtypes
  
- url: https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.describe.html
  why: Generate statistical summaries for numeric columns

- url: https://github.com/soda-inria/tabicl
  why: Understanding TabICL model requirements for data format

- url: https://cran.r-project.org/web/packages/openVA/openVA.pdf
  why: OpenVA package documentation for VA data formats and ConvertData functions
  sections:
    - ConvertData.phmrc function (page ~20-25)
    - PHMRC data format specifications
    - Cause list mappings

- url: https://journal.r-project.org/articles/RJ-2023-020/
  why: OpenVA Toolkit article explaining VA data structures and formats
  critical: Understanding PHMRC data structure and column conventions
  
- file: models/model_config.py
  why: Pattern for configuration management and pydantic usage

- file: PLANNING.md
  why: Understand overall project context and data requirements
  sections: 
    - "2.1 Training Data (PHMRC Format)" - lines 20-26
    - "5.1 PHMRC Cause Categories" - lines 173-177
    - "3.2 Data Preparation" - lines 51-54 (OpenVA data conversion)

- doc: PHMRC Dataset Information
  critical: |
    - gs_text34 is the gold standard cause of death column (34 reduced causes)
    - g-prefixed columns are symptoms (e.g., g5_0_1 through g5_07_14)
    - g1-prefixed columns are administrative and should be dropped
    - Dataset has 2,075 child cases from 6 sites
    - Child causes include: Pneumonia, Diarrhea/Dysentery, Malaria, HIV/AIDS, etc.
    - OpenVA expects PHMRC format with specific column naming conventions
```

### Current Codebase tree (run `tree` in the root of the project) to get an overview of the codebase
```bash
/Users/ericliu/projects6/insilico-tabicl
├── CLAUDE.md
├── DOCKER_USAGE.md
├── Dockerfile
├── PLANNING.md
├── PRPs
│   └── templates
├── TASK.md
├── data
│   ├── 20250609_gs34_vs_UC_CHAMPS_desc[92].r
│   ├── intermediate
│   ├── processed
│   └── raw
│       └── PHMRC
│           ├── IHME_PHMRC_VA_DATA_ADULT_Y2013M09D11_0.csv
│           ├── IHME_PHMRC_VA_DATA_CHILD_Y2013M09D11_0.csv
│           ├── IHME_PHMRC_VA_DATA_CODEBOOK_Y2013M09D11_0.xlsx
│           └── IHME_PHMRC_VA_DATA_NEONATE_Y2013M09D11_0.csv
├── data_exploration  # Empty directory for exploration outputs
├── models
│   ├── __init__.py
│   ├── insilico_model.py
│   ├── model_config.py
│   ├── model_validator.py
│   ├── tabicl_config.py
│   ├── tabicl_model.py
│   ├── xgboost_config.py
│   ├── xgboost_enhanced_config.py
│   └── xgboost_model.py
├── pyproject.toml
├── results
└── tests
```

### Desired Codebase tree with files to be added and responsibility of file
```bash
├── data_exploration
│   ├── explore_phmrc_child.py  # Main exploration script
│   ├── results/
│   │   ├── child_dataset_summary.txt  # Text summary of findings
│   │   ├── child_cause_distribution.csv  # Cause of death distribution
│   │   ├── child_column_info.csv  # Column metadata with category (name, dtype, non-null count, category)
│   │   │                           # category: 'label' (gs_text34), 'feature' (symptom columns), 
│   │   │                           # 'drop' (administrative), or 'other' (uncertain)
│   │   └── child_missing_data_report.csv  # Missing data analysis
│   └── __init__.py
└── tests
    └── test_data_exploration.py  # Unit tests for exploration functions
```

### Known Gotchas of our codebase & Library Quirks
```python
# CRITICAL: Use poetry for all Python execution
# Example: poetry run python data_exploration/explore_phmrc_child.py

# CRITICAL: Large CSV files may have mixed dtypes
# Use low_memory=False or specify dtypes explicitly for large datasets

# CRITICAL: PHMRC column naming conventions
# g-prefixed columns = symptoms (keep for modeling)
# g1-prefixed columns = administrative (drop for modeling)
# gs_text34 = gold standard cause (target variable)

# CRITICAL: Handle missing values properly
# VA data commonly has missing symptoms - document patterns

# CRITICAL: No mock data - use real PHMRC data only
# File exists at: data/raw/PHMRC/IHME_PHMRC_VA_DATA_CHILD_Y2013M09D11_0.csv
```

### Subagents Involved
```yaml
# List all subagents that will be used in this PRP
subagents:
  - name: researcher
    role: Deep research and information gathering
    tasks:
      - Research PHMRC data format documentation
      - Gather OpenVA and TabICL requirements
      - Find best practices for VA data exploration
  
  - name: va-data-relationship-analyst
    role: Analyze VA dataset structure and relationships
    tasks: 
      - Understand PHMRC data format
      - Identify symptom patterns
      - Map cause of death categories
  
  - name: openva-insilico-expert
    role: OpenVA/InSilicoVA expertise
    tasks:
      - Advise on PHMRC data format requirements
      - Validate column naming conventions
      - Ensure compatibility with OpenVA ConvertData functions
  
  - name: tabicl-expert
    role: TabICL framework expertise
    tasks:
      - Advise on data format requirements for TabICL
      - Validate feature engineering approach
      - Ensure compatibility with TabICL input format
  
  - name: validation-gates
    role: Validate code and run tests
    tasks:
      - Run ruff/mypy checks
      - Execute unit tests
      - Verify output files are created
```

### list of Sub-Tasks to be completed to fullfill the PRP in the order they should be completed

```yaml
Sub-Task 1: Create initial exploration script structure
CREATE data_exploration/explore_phmrc_child.py:
  - Setup imports (pandas, numpy, pathlib, json, logging)
  - Configure logging for exploration progress
  - Define main() function and if __name__ == "__main__" block

Sub-Task 2: Implement data loading with error handling
MODIFY data_exploration/explore_phmrc_child.py:
  - Add load_phmrc_child_data() function
  - Use proper file path: data/raw/PHMRC/IHME_PHMRC_VA_DATA_CHILD_Y2013M09D11_0.csv
  - Include try/except for file loading errors
  - Log successful loading with shape info

Sub-Task 3: Implement gs_text34 validation
MODIFY data_exploration/explore_phmrc_child.py:
  - Add validate_gs_text34() function
  - Check column exists
  - Get unique causes and counts
  - Verify no null values in gs_text34
  - Return cause distribution DataFrame

Sub-Task 4: Implement column categorization
MODIFY data_exploration/explore_phmrc_child.py:
  - Add categorize_columns() function
  - Identify symptom columns (regex: ^g[0-9])
  - Identify administrative columns (regex: ^g1)
  - Identify other columns
  - Return dictionary of column categories

Sub-Task 5: Implement missing data analysis
MODIFY data_exploration/explore_phmrc_child.py:
  - Add analyze_missing_data() function
  - Calculate missing percentage per column
  - Identify completely empty columns
  - Create missing data summary

Sub-Task 6: Save results to files
MODIFY data_exploration/explore_phmrc_child.py:
  - Add save_exploration_results() function
  - Save text summary to child_dataset_summary.txt
  - Save cause distribution to CSV
  - Save column info to CSV with 'category' field:
    * 'label' for gs_text34
    * 'feature' for symptom columns (g-prefixed)
    * 'drop' for administrative columns (g1-prefixed)
    * 'other' for uncertain columns
  - Save missing data report to CSV

Sub-Task 7: Create comprehensive tests
CREATE tests/test_data_exploration.py:
  - Test data loading function
  - Test column categorization logic
  - Test output file creation
  - Use actual data file (no mocks)
```

## Implementation Blueprint

### Data models and structure
```python
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import pandas as pd
from pydantic import BaseModel, Field

class DatasetSummary(BaseModel):
    """Summary statistics for PHMRC dataset."""
    n_rows: int = Field(description="Number of cases")
    n_cols: int = Field(description="Total number of columns")
    n_symptom_cols: int = Field(description="Number of symptom columns")
    n_admin_cols: int = Field(description="Number of administrative columns")
    n_causes: int = Field(description="Number of unique causes in gs_text34")
    missing_rate: float = Field(description="Overall missing data rate")
    
class CauseDistribution(BaseModel):
    """Distribution of causes of death."""
    cause: str = Field(description="Cause of death label")
    count: int = Field(description="Number of cases")
    percentage: float = Field(description="Percentage of total cases")
```

### Per Sub-Task pseudocode as needed added to each Sub-Task
```python
# Sub-Task 2: Data loading implementation
def load_phmrc_child_data(data_path: Path) -> pd.DataFrame:
    """Load PHMRC child dataset with proper error handling."""
    # PATTERN: Always use pathlib for file paths
    if not data_path.exists():
        raise FileNotFoundError(f"Dataset not found at {data_path}")
    
    # GOTCHA: Large CSV may have mixed types, use low_memory=False
    try:
        df = pd.read_csv(data_path, low_memory=False)
        logger.info(f"Loaded dataset: {df.shape[0]} rows, {df.shape[1]} columns")
        return df
    except Exception as e:
        logger.error(f"Failed to load dataset: {e}")
        raise

# Sub-Task 3: gs_text34 validation
def validate_gs_text34(df: pd.DataFrame) -> pd.DataFrame:
    """Validate and analyze gs_text34 column."""
    # CRITICAL: gs_text34 must exist and have no nulls
    if 'gs_text34' not in df.columns:
        raise ValueError("gs_text34 column not found in dataset")
    
    # Check for nulls
    null_count = df['gs_text34'].isnull().sum()
    if null_count > 0:
        logger.warning(f"Found {null_count} null values in gs_text34")
    
    # Get distribution
    cause_dist = df['gs_text34'].value_counts()
    cause_df = pd.DataFrame({
        'cause': cause_dist.index,
        'count': cause_dist.values,
        'percentage': (cause_dist.values / len(df)) * 100
    })
    
    return cause_df

# Sub-Task 4: Column categorization
def categorize_columns(df: pd.DataFrame) -> Dict[str, List[str]]:
    """Categorize columns by type."""
    # PATTERN: Use regex to identify column patterns
    import re
    
    categories = {
        'symptom_columns': [],  # g[0-9] pattern
        'admin_columns': [],    # g1 pattern
        'target_column': ['gs_text34'],
        'other_columns': []
    }
    
    for col in df.columns:
        if col == 'gs_text34':
            continue  # Already in target_column
        elif re.match(r'^g[0-9]', col):
            categories['symptom_columns'].append(col)
        elif re.match(r'^g1', col):
            categories['admin_columns'].append(col)
        else:
            categories['other_columns'].append(col)
    
    return categories

# Sub-Task 6: Enhanced column info with categories
def create_column_info(df: pd.DataFrame, categories: Dict[str, List[str]]) -> pd.DataFrame:
    """Create column info DataFrame with categories."""
    column_info = []
    
    for col in df.columns:
        # Determine category
        if col == 'gs_text34':
            category = 'label'
        elif col in categories['symptom_columns']:
            category = 'feature'
        elif col in categories['admin_columns']:
            category = 'drop'
        else:
            category = 'other'
        
        column_info.append({
            'column_name': col,
            'dtype': str(df[col].dtype),
            'non_null_count': df[col].notna().sum(),
            'null_count': df[col].isna().sum(),
            'null_percentage': (df[col].isna().sum() / len(df)) * 100,
            'category': category
        })
    
    return pd.DataFrame(column_info)
```

### Integration Points
```yaml
DATA:
  - input: data/raw/PHMRC/IHME_PHMRC_VA_DATA_CHILD_Y2013M09D11_0.csv
  - output: data_exploration/results/
  
MODELS:
  - reference: models/model_config.py for pydantic patterns
  
TESTS:
  - add to: tests/test_data_exploration.py
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
poetry run ruff check data_exploration/explore_phmrc_child.py --fix
poetry run mypy data_exploration/explore_phmrc_child.py

# Expected: No errors. If errors, READ the error and fix.
```

### Level 2: Unit Tests each new feature/file/function use existing test patterns
```python
# CREATE tests/test_data_exploration.py with these test cases:
def test_load_phmrc_child_data():
    """Test that child dataset loads successfully."""
    from data_exploration.explore_phmrc_child import load_phmrc_child_data
    from pathlib import Path
    
    data_path = Path("data/raw/PHMRC/IHME_PHMRC_VA_DATA_CHILD_Y2013M09D11_0.csv")
    df = load_phmrc_child_data(data_path)
    
    assert df is not None
    assert len(df) > 0
    assert 'gs_text34' in df.columns

def test_column_categorization():
    """Test column categorization logic."""
    from data_exploration.explore_phmrc_child import categorize_columns
    import pandas as pd
    
    # Create test dataframe with known column patterns
    test_df = pd.DataFrame(columns=['gs_text34', 'g5_01', 'g10_02', 'g1_admin', 'other_col'])
    categories = categorize_columns(test_df)
    
    assert 'g5_01' in categories['symptom_columns']
    assert 'g10_02' in categories['symptom_columns']
    assert 'g1_admin' in categories['admin_columns']
    assert 'other_col' in categories['other_columns']

def test_output_files_created():
    """Test that exploration creates all expected output files."""
    import subprocess
    from pathlib import Path
    
    # Run the exploration script
    result = subprocess.run(
        ["poetry", "run", "python", "data_exploration/explore_phmrc_child.py"],
        capture_output=True,
        text=True
    )
    
    assert result.returncode == 0
    
    # Check output files exist
    output_dir = Path("data_exploration/results")
    assert (output_dir / "child_dataset_summary.txt").exists()
    assert (output_dir / "child_cause_distribution.csv").exists()
    assert (output_dir / "child_column_info.csv").exists()
```

```bash
# Run and iterate until passing:
poetry run pytest tests/test_data_exploration.py -v
# If failing: Read error, understand root cause, fix code, re-run (never mock to pass)
```

### Level 3: Integration Test
```bash
# Actually run the exploration script
poetry run python data_exploration/explore_phmrc_child.py

# Verify outputs exist and contain data
ls -la data_exploration/results/
cat data_exploration/results/child_dataset_summary.txt | head -20

# Check cause distribution makes sense
wc -l data_exploration/results/child_cause_distribution.csv
# Should have ~21 child causes based on PHMRC documentation
```

## Final validation Checklist
- [ ] All tests pass: `poetry run pytest tests/test_data_exploration.py -v`
- [ ] No linting errors: `poetry run ruff check data_exploration/`
- [ ] No type errors: `poetry run mypy data_exploration/`
- [ ] Exploration script runs successfully: `poetry run python data_exploration/explore_phmrc_child.py`
- [ ] All 4 output files created in data_exploration/results/
- [ ] gs_text34 column validated with cause distribution
- [ ] Symptom columns identified (g-prefixed pattern)
- [ ] Documentation in child_dataset_summary.txt is comprehensive

---

## Anti-Patterns to Avoid
- ❌ Don't use mock or synthetic data - use real PHMRC file
- ❌ Don't skip validation of gs_text34 column
- ❌ Don't ignore missing data patterns - document them
- ❌ Don't hardcode file paths - use pathlib
- ❌ Don't catch all exceptions - be specific
- ❌ Don't forget to use poetry for execution

## Confidence Score: 9/10
High confidence due to:
- Clear task requirements
- Existing data file confirmed
- Well-defined column patterns
- Straightforward pandas operations
- Comprehensive validation tests

Minor uncertainty on exact cause count (documentation suggests ~21 child causes) but this will be discovered during exploration.