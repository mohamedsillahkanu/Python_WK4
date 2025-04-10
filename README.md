---
title: "Data preprocessing"
weight: 2
order: 2
format: 
  html:
    toc: true
    toc-depth: 4
---

# Data Preprocessing

## Overview   
Data preprocessing cleans and formats DHIS2 data for SNT analysis. We work with monthly routine health facility data to generate cleaned datasets at both facility level and administrative levels, which support incidence estimation and seasonality analysis.

## Learning Objectives   
- [ ] Import and combine DHIS2 data files  
- [ ] Clean and rename key variables using tidyverse  
- [ ] Aggregate data monthly at the admin level  
- [ ] Save and export cleaned datasets

## Step-by-Step Workflow  

### Step 1: Install required packages   

::: {.panel-tabset}

## R

```r
# Check if pacman is installed, if not install it
if (!requireNamespace("pacman", quietly = TRUE)) {
  install.packages("pacman")
}

# Load required packages
pacman::p_load(
  readxl,  # for importing Excel files
  dplyr,   # for data manipulation
  tidyr,   # for data reshaping
  janitor, # for data cleaning
  writexl  # for exporting to Excel
)
```

::: {.callout-note}
These packages only need to be installed once. Use `pacman` to make package management easier.
:::

## Python
<!-- Python equivalent code would go here -->
:::

### Step 2: Set up your working directory  

::: {.panel-tabset}

## R

```r
# Set your working directory to manage file paths and save outputs
setwd("path/to/your/directory")
```

## Python
<!-- Python equivalent code would go here -->
:::

### Step 3: Import data files  

#### Step 3.1: Read a single file

::: {.panel-tabset}

## R

```r
# Import Excel file
raw_data <- readxl::read_excel("data/filename.xlsx")

# For CSV files with comma delimiter
# raw_data <- readr::read_csv("data/filename.csv")

# For CSV files with semicolon delimiter
# raw_data <- readr::read_csv2("data/filename.csv")
```

## Python
<!-- Python equivalent code would go here -->
:::

#### Step 3.2: Read multiple files and combine them

::: {.panel-tabset}

## R

```r
# Get all Excel files in working directory
data_files <- list.files(pattern = "\\.xlsx$", full.names = TRUE)

# Import all files
myfiles <- lapply(data_files, readxl::read_excel)

# Combine into a single data frame
raw_data <- dplyr::bind_rows(myfiles)
```

::: {.callout-warning}
Make sure all Excel files have the same structure before binding them.
:::

## Python
<!-- Python equivalent code would go here -->
:::

### Step 4: View and understand your data   

::: {.panel-tabset}

## R

```r
# View data structure
dplyr::glimpse(raw_data)

# View first few rows
head(raw_data)
```

## Python
<!-- Python equivalent code would go here -->
:::

### Step 5: Select and rename key variables  

::: {.panel-tabset}

## R

```r
# Clean and prepare the dataset
clean_data <- raw_data |>
  # Clean column names: lowercase, snake_case
  janitor::clean_names() |>
  # Select and rename key variables
  dplyr::select(
    # Administrative variables
    adm1 = orgunitlevel2, 
    adm2 = orgunitlevel3,
    facility = organisationunitname, 
    period = periodname,
    
    # Reporting completeness
    reprate = consultation_externe_reporting_rate,
    reptime = consultation_externe_reporting_rate_on_time,
    
    # Outpatient cases
    allout_u5 = c_ext_nombre_de_nouveaux_cas_toutes_causes_confondues_moins_de_5_ans,
    allout_ov5 = c_ext_nombre_de_nouveaux_cas_toutes_causes_confondues_5_ans_et_plus_sans_fe,
    allout_preg = c_ext_nombre_de_nouveaux_cas_toutes_causes_confondues_fe,
    
    # Suspected malaria cases
    susp_u5 = c_ext_nombre_de_cas_suspects_de_paludisme_moins_de_5_ans,
    susp_ov5 = c_ext_nombre_de_cas_suspects_de_paludisme_5_ans_et_plus_sans_fe,
    susp_preg = c_ext_nombre_de_cas_suspects_de_paludisme_fe,
    
    # Additional variables would go here...
    # Add all other variables with clear naming

    # Prevention indicators 
    iptp1 = smi_nombre_de_femmes_enceintes_ayant_pris_une_dose_de_tpi,
    iptp2 = smi_nombre_de_femmes_enceintes_ayant_pris_deux_doses_de_tpi,
    iptp3 = smi_nombre_de_femmes_enceintes_ayant_pris_trois_doses_de_tpi
  ) |>
  # Split period into month and year
  tidyr::separate(
    col = period,
    into = c("month", "year"),
    sep = " "
  ) |>
  # Convert month names to numeric 
  dplyr::mutate(
    month = match(
      month,
      c("Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre")
    ),
    # Convert to integers
    month = base::as.integer(month),
    year = base::as.integer(year)
  )
```

## Python
<!-- Python equivalent code would go here -->
:::

### Step 6: Detect and replace outliers

::: {.panel-tabset}

## R

```r
# For detailed outlier detection methodology, see:
# https://ahadi-analytics.github.io/snt-code-library/english/library/data/routine_cases/outlier_correction.html

# Basic example of outlier detection using IQR method
outlier_detection <- clean_data |>
  # Group by facility for facility-specific thresholds
  dplyr::group_by(facility) |>
  dplyr::mutate(
    # Calculate statistics for confirmed cases
    conf_median = median(conf_rdt_u5, na.rm = TRUE),
    conf_q1 = quantile(conf_rdt_u5, 0.25, na.rm = TRUE),
    conf_q3 = quantile(conf_rdt_u5, 0.75, na.rm = TRUE),
    conf_iqr = conf_q3 - conf_q1,
    conf_upper = conf_q3 + (1.5 * conf_iqr),
    conf_lower = conf_q1 - (1.5 * conf_iqr),
    conf_is_outlier = conf_rdt_u5 > conf_upper | conf_rdt_u5 < conf_lower
  ) |>
  dplyr::ungroup()

# Replace outliers with the median
corrected_data <- outlier_detection |>
  dplyr::mutate(
    conf_rdt_u5 = ifelse(conf_is_outlier, conf_median, conf_rdt_u5)
  )
```

::: {.callout-tip}
Apply similar outlier detection to other key variables. Consider your domain knowledge when defining outlier thresholds.
:::

## Python
<!-- Python equivalent code would go here -->
:::

### Step 7: Compute new variables

::: {.panel-tabset}

## R

```r
# Add calculated variables
computed_data <- corrected_data |>
  dplyr::rowwise() |>
  dplyr::mutate(
    # === Outpatient totals ===
    allout = sum(
      dplyr::c_across(
        c(allout_u5, allout_ov5, allout_preg,
          allout_u5_chw, allout_ov5_chw, allout_preg_chw)
      ), 
      na.rm = TRUE
    ),
    
    # === Suspected malaria cases ===
    susp = sum(
      dplyr::c_across(
        c(susp_u5, susp_ov5, susp_preg,
          susp_u5_chw, susp_ov5_chw, susp_preg_chw)
      ), 
      na.rm = TRUE
    ),
    
    # === Community cases ===
    susp_chw = sum(
      dplyr::c_across(
        c(susp_u5_chw, susp_ov5_chw, susp_preg_chw)
      ), 
      na.rm = TRUE
    ),
    
    # === Testing totals ===
    test_u5 = sum(
      dplyr::c_across(
        c(test_rdt_u5, test_mic_u5, test_rdt_u5_chw)
      ), 
      na.rm = TRUE
    ),
    
    test_ov5 = sum(
      dplyr::c_across(
        c(test_rdt_ov5, test_mic_ov5, test_rdt_ov5_chw)
      ), 
      na.rm = TRUE
    ),
    
    test_preg = sum(
      dplyr::c_across(
        c(test_rdt_preg, test_mic_preg, test_rdt_preg_chw)
      ), 
      na.rm = TRUE
    ),
    
    test = sum(test_u5, test_ov5, test_preg, na.rm = TRUE),
    
    # === Other totals would continue here... ===
    
    # === Calculate key indicators ===
    test_positivity = if (test > 0) {
      conf / test
    } else {
      NA_real_
    }
  ) |>
  dplyr::ungroup()
```

## Python
<!-- Python equivalent code would go here -->
:::

### Step 8: Save the cleaned data

::: {.panel-tabset}

## R

```r
# Save as CSV
readr::write_csv(computed_data, "cleaned_data/facility_level_data.csv")
```

## Python
<!-- Python equivalent code would go here -->
:::

### Step 9: Aggregate data by administrative level

#### Step 9.1: Monthly aggregation

::: {.panel-tabset}

## R

```r
# Monthly aggregation at administrative level 2
monthly_adm2_data <- computed_data |>
  dplyr::group_by(adm1, adm2, year, month) |>
  dplyr::summarise(
    # Aggregate all numeric variables
    dplyr::across(
      dplyr::where(is.numeric), 
      ~ sum(.x, na.rm = TRUE)
    ),
    .groups = "drop"
  )

# Save monthly aggregated data
readr::write_csv(monthly_adm2_data, "aggregated_data/monthly_adm2_data.csv")
```

## Python
<!-- Python equivalent code would go here -->
:::

#### Step 9.2: Annual aggregation

::: {.panel-tabset}

## R

```r
# Yearly aggregation at administrative level 2
yearly_adm2_data <- computed_data |>
  dplyr::group_by(adm1, adm2, year) |>
  dplyr::summarise(
    # Aggregate all numeric variables
    dplyr::across(
      dplyr::where(is.numeric), 
      ~ sum(.x, na.rm = TRUE)
    ),
    .groups = "drop"
  )

# Save yearly aggregated data
readr::write_csv(yearly_adm2_data, "aggregated_data/yearly_adm2_data.csv")
```

## Python
<!-- Python equivalent code would go here -->
:::

## Common Mistakes to Avoid  

- Not checking for data inconsistencies before analysis
- Forgetting to handle missing values with `na.rm = TRUE`
- Mixing variable naming conventions
- Overwriting raw data files
- Not validating outlier replacements against domain knowledge

## Summary and Next Steps

This preprocessing workflow has prepared your DHIS2 data for SNT analysis by cleaning, standardizing, and aggregating the data. 


