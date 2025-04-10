# DHIS2 Data Preprocessing: Code Breakdown & Explanation

This document breaks down the R code for preprocessing DHIS2 malaria data, explaining each section's purpose, techniques used, and best practices implemented.

## 1. Package Management

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
  writexl,  # for exporting to Excel
  readr    # for reading/writing CSV files
)
```

**What's happening here:**
- The code first checks if the `pacman` package is installed, and installs it if necessary
- It then uses `pacman` to load all required packages in one command
- Each package has a comment explaining its purpose

**Why this approach:**
- Using `pacman::p_load()` simplifies package management by handling both installation and loading
- Comments make it clear what each package is for
- This approach is more efficient than separate `library()` calls

## 2. File Management

```r
# Set working directory
setwd("path/to/your/directory")

# Create output directories
dir.create("cleaned_data", showWarnings = FALSE)
dir.create("aggregated_data", showWarnings = FALSE)
```

**What's happening here:**
- Setting the working directory for consistent file paths
- Creating directories for processed outputs (if they don't already exist)
- `showWarnings = FALSE` suppresses errors if directories already exist

**Why this approach:**
- Organizing outputs in separate directories prevents clutter
- Creating directories programmatically ensures they exist before saving files
- This supports reproducible workflows where anyone can run the code

## 3. Data Import

```r
# Get list of Excel files
file_paths <- list.files(pattern = "\\.xlsx$", full.names = TRUE)

# Import all files
data_files <- lapply(file_paths, readxl::read_excel)

# Combine into a single data frame
raw_data <- dplyr::bind_rows(data_files)
```

**What's happening here:**
- `list.files()` gets all Excel files in the working directory
- `lapply()` reads each file using `readxl::read_excel()`
- `bind_rows()` combines all data frames into one

**Why this approach:**
- This handles multiple data files efficiently
- Using `lapply()` applies the same function to each file
- Package prefixes (e.g., `readxl::read_excel`) make function sources explicit
- The pattern `\\.xlsx$` ensures only Excel files are processed

## 4. Data Cleaning and Transformation

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
    
    # [Additional variables organized by category...]
    
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

**What's happening here:**
- `janitor::clean_names()` standardizes column names to lowercase snake_case
- `dplyr::select()` both selects and renames variables in one step
- Variables are grouped by logical categories with comments
- `tidyr::separate()` splits the period column into month and year
- `match()` converts French month names to numeric values
- `as.integer()` ensures proper data types

**Why this approach:**
- Clean, consistent variable names improve code readability
- Organizing variables by category with comments makes the code self-documenting
- Using base R pipe (`|>`) makes the data flow explicit
- Explicit type conversion prevents issues with calculations later
- Breaking each pipe operation into its own line improves readability

## 5. Outlier Detection and Replacement

```r
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

**What's happening here:**
- Using the Interquartile Range (IQR) method to detect outliers
- For each facility:
  1. Calculate the median, Q1 (25th percentile), and Q3 (75th percentile)
  2. Calculate IQR = Q3 - Q1
  3. Set upper bound = Q3 + 1.5*IQR
  4. Set lower bound = Q1 - 1.5*IQR
  5. Flag values outside these bounds as outliers
- Replace outliers with the facility-specific median

**Why this approach:**
- Grouping by facility accounts for different facility sizes and patterns
- The IQR method is robust to non-normal distributions
- Using facility-specific medians preserves facility-level patterns
- `na.rm = TRUE` handles missing values appropriately
- `ungroup()` prevents unexpected behavior in subsequent operations

## 6. Computing New Variables

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
    
    # [Additional calculated variables...]
    
    # === Calculate key indicators ===
    test_positivity = if (test > 0) {
      conf / test
    } else {
      NA_real_
    }
  ) |>
  dplyr::ungroup()
```

**What's happening here:**
- `rowwise()` performs calculations row by row
- `c_across()` selects multiple columns for operations within `rowwise()`
- Calculated variables are organized by category
- Conditional logic (`if (test > 0)`) prevents division by zero
- `NA_real_` ensures correct data type for missing values

**Why this approach:**
- `rowwise()` enables per-row operations across multiple columns
- Category headers as comments improve readability
- Handling edge cases (like division by zero) prevents errors
- `na.rm = TRUE` properly handles missing values in calculations
- `ungroup()` prevents unexpected behavior in subsequent operations

## 7. Saving Processed Data

```r
# Save as CSV
readr::write_csv(computed_data, "cleaned_data/facility_level_data.csv")

# Save as Excel (optional)
writexl::write_xlsx(computed_data, "cleaned_data/facility_level_data.xlsx")
```

**What's happening here:**
- Saving the processed data in CSV format
- Optionally saving in Excel format for users who prefer it

**Why this approach:**
- CSV files are efficient, portable, and work with many tools
- Saving to the `cleaned_data` directory keeps files organized
- Multiple formats accommodate different user preferences

## 8. Aggregating Data

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

**What's happening here:**
- Creating two aggregated datasets:
  1. Monthly data by administrative level 2
  2. Yearly data by administrative level 2
- `across(where(is.numeric), ~ sum(.x, na.rm = TRUE))` sums all numeric columns
- `.groups = "drop"` removes grouping after summarization
- Saving the aggregated data to separate files

**Why this approach:**
- `across()` with `where(is.numeric)` efficiently processes all numeric columns
- Using `~ sum(.x, na.rm = TRUE)` properly handles missing values
- Different temporal aggregations support various analysis needs
- Saving to the `aggregated_data` directory keeps files organized

