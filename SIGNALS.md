# Signal Calculations

This document describes how each signal is calculated and how they are combined to create the Blockbuster Index.

## Amazon Signal

The Amazon signal measures e-commerce adoption and digital retail presence by analyzing job posting patterns across all U.S. states using a sophisticated sliding window algorithm for improved accuracy and stability.

**Data Source**

- Amazon job postings via web scraping.

**Calculation Method**:

- Scrapes job postings for each state using Puppeteer.
- Counts total job postings per state for the cuxrrent day.
- Maintains a 90-day sliding window of job posting data in DynamoDB.
- Calculates rolling averages to smooth out daily fluctuations and seasonal variations.
- Normalizes job counts by workforce size per state using Census Bureau labor force data.

**Sliding Window Algorithm**:

- **Window Size**: 90-day rolling window for optimal balance of responsiveness and stability.
- **Data Aggregation**: Maintains daily job counts and calculates running averages.
- **Window Management**: Automatically removes data older than 90 days and adds new daily data.
- **Fallback Logic**: Uses current day data for development environments without DynamoDB access.

**Technical Implementation**:

- Uses Puppeteer for dynamic content scraping.
- Implements retry logic with exponential backoff.
- Handles rate limiting and anti-bot measures.
- Processes results in parallel for efficiency.
- DynamoDB integration for sliding window data persistence.
- Automatic window management with efficient aggregate updates.

**Workforce Normalization Details**:

The Amazon signal uses workforce normalization to provide fair comparisons across states of different sizes:

- **Data Source**: U.S. Census Bureau American Community Survey (ACS) labor force data.
- **Metric**: Amazon jobs per million workforce (Amazon jobs / total workforce × 1,000,000).

## Census Signal

**Data Source:**

- U.S. Census Bureau API

**Technical Implementation:**

- REST API integration with Census Bureau endpoints
- Fetches demographic data, including:
  - Retail establishment counts (NAICS 44-45)
  - State population
  - Workforce size (used for normalization in other signals)

**Calculation Method:**

- Calculates retail establishments per 100,000 population (establishment count / population × 100,000)
- No other subfactors or weights are currently used in the Census signal calculation

## Broadband Signal

**Coverage Measurement:**

- Coverage is measured as the percentage of census blocks (not population or land area) with broadband service.
- A census block is the smallest geographic unit used by the U.S. Census Bureau, typically containing a few dozen to a few hundred people.

**Score Calculation:**

- The broadband score is a weighted sum of:
  - 30%: Basic broadband availability (percent of blocks with any broadband)
  - 40%: High-speed availability (percent of blocks with 25+ Mbps)
  - 20%: Gigabit availability (percent of blocks with gigabit)
  - 10%: Technology diversity (fraction of 5 tech types present)
- **Formula:**
  Broadband Score = 0.3 × Basic + 0.4 × High-Speed + 0.2 × Gigabit + 0.1 × Diversity

**Weighting Rationale:**

- The weights were chosen to emphasize high-speed access and future-ready infrastructure, while still rewarding basic coverage and technology diversity.
- These weights are based on domain knowledge and the desire to balance quality, reach, and resilience in broadband infrastructure.

## Walmart Signal

The Walmart signal provides a dual-perspective analysis of retail employment patterns by separately tracking physical retail jobs and technology jobs, offering insights into the balance between traditional and digital retail infrastructure.

**Data Source**:

- Walmart Careers job board via web scraping.

**Calculation Method**:

- **Physical Jobs Signal**: Scrapes Walmart store and Sam's Club job postings across all states.

  - Uses inverted scoring where higher physical job counts result in lower digital adoption scores.
  - Implements 90-day sliding window aggregation for stability.
  - Reflects traditional retail presence and employment patterns.

- **Technology Jobs Signal**: Scrapes technology and digital job postings across all states.
  - Uses positive scoring where higher technology job counts result in higher digital adoption scores.
  - Includes software engineering, data science, and digital transformation roles.
  - Reflects digital infrastructure and technology investment.

**Dual-Signal Approach**:

- **Physical Retail Jobs**: Measures traditional brick-and-mortar retail presence.
- **Technology Jobs**: Measures digital transformation and e-commerce infrastructure.
- **Combined Analysis**: Provides comprehensive view of retail employment evolution.

**Technical Implementation**:

- Puppeteer-based web scraping with anti-detection measures.
- Dual job category filtering and classification.
- Sliding window aggregation for both signal types.
- Inverted scoring algorithm for physical jobs.
- Workforce normalization using Census data.

**Walmart Signal Sub-Signals and Index Integration**

The Walmart signal is split into two sub-signals:

- **Physical Jobs:** Normalized to a 0–100 scale and inverted so that higher = more digital (i.e., fewer physical jobs means a higher score).
- **Technology Jobs:** Normalized to a 0–100 scale so that higher = more digital (i.e., more technology jobs means a higher score).

Both sub-signals are used as separate components in the Blockbuster Index, each with their own weight (see WEIGHTS in the codebase). There is currently no single combined "Walmart Score"; instead, both normalized sub-signals are incorporated independently into the overall index.

## Blockbuster Index Calculation

The Blockbuster Index combines all individual signals using a weighted aggregation algorithm to create a comprehensive score that reflects the balance between digital and physical retail activity in each state.

### Signal Weighting System

Each signal is assigned a weight based on its relevance to the overall retail transformation:

| Signal    | Weight | Rationale                                                            |
| --------- | ------ | -------------------------------------------------------------------- |
| Amazon    | 0.35   | Primary indicator of e-commerce adoption and digital retail presence |
| Walmart   | 0.25   | Dual-perspective analysis of retail employment evolution             |
| Census    | 0.20   | Demographic and economic context for retail behavior                 |
| Broadband | 0.20   | Infrastructure foundation for digital commerce                       |

### Calculation Formula

The Blockbuster Index for each state is calculated using the following formula:

```
Blockbuster Index = (Amazon Score × 0.35) + (Walmart Score × 0.25) + (Census Score × 0.20) + (Broadband Score × 0.20)
```

### Score Normalization

All individual signal scores are normalized to a 0-100 scale before aggregation:

- **0-25**: Low digital adoption, strong physical retail presence
- **26-50**: Moderate digital adoption, balanced retail landscape
- **51-75**: High digital adoption, declining physical retail
- **76-100**: Very high digital adoption, minimal physical retail presence

### Historical Tracking

The system maintains historical records of both individual signal scores and the final Blockbuster Index:

- **Daily Signal Scores**: Individual signal calculations stored in DynamoDB
- **Daily Blockbuster Index**: Final aggregated scores stored in DynamoDB
- **S3 Storage**: Versioned JSON files for web consumption
- **Metadata**: Calculation timestamps and version information

### Data Flow

1. **Signal Collection**: Each signal task runs independently and calculates state-specific scores
2. **Data Persistence**: Individual signal results stored in DynamoDB with timestamps
3. **S3 Upload**: Signal results uploaded to S3 with versioned filenames
4. **Index Calculation**: Blockbuster Index task downloads all signal results
5. **Aggregation**: Weighted combination of all signals using the formula above
6. **Result Publication**: Final Blockbuster Index uploaded to S3 for web consumption

### Quality Assurance

The calculation process includes several quality checks:

- **Data Validation**: Ensures all signal scores are within expected ranges
- **Completeness Check**: Verifies all states have data from all signals
- **Anomaly Detection**: Flags unusual score changes for investigation
- **Fallback Logic**: Uses previous day's data if current calculation fails

### Performance Optimization

The aggregation process is optimized for speed and reliability:

- **Parallel Processing**: Signal calculations run concurrently
- **Caching**: Frequently accessed data cached in memory
- **Incremental Updates**: Only recalculates when new signal data is available
- **Error Handling**: Graceful degradation when individual signals fail
