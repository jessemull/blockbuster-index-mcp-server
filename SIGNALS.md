# Signal Calculations

This document describes how each signal is calculated and how they are combined to create the Blockbuster Index.

---

## Amazon Signal

**Purpose:**
Measures e-commerce adoption and digital retail presence by analyzing Amazon job posting patterns across all U.S. states.

**Data Source:**

- Amazon job postings via web scraping.

**Calculation Method:**

- Scrapes job postings for each state using Puppeteer.
- Counts total job postings per state for the current day.
- Maintains a 90-day sliding window of job posting data in DynamoDB.
- Calculates rolling averages to smooth out daily fluctuations and seasonal variations.
- Normalizes job counts by workforce size per state using Census Bureau labor force data.

**Normalization & Inversion:**

- Scores are normalized to a 0–100 scale (higher = more digital adoption).
- No inversion is applied to this signal.

**Technical Implementation:**

- Puppeteer for dynamic content scraping.
- Retry logic with exponential backoff.
- Handles rate limiting and anti-bot measures.
- Processes results in parallel for efficiency.
- DynamoDB integration for sliding window data persistence and automatic window management.

---

## Census Signal

**Purpose:**
Provides a measure of physical retail market maturity using U.S. Census Bureau data on retail establishments.

**Data Source:**

- U.S. Census Bureau API (retail establishment counts, population, workforce size).

**Calculation Method:**

- Calculates retail establishments per 100,000 population (establishment count / population × 100,000).

**Normalization & Inversion:**

- Scores are normalized to a 0–100 scale.
- **After normalization, this score is inverted** (higher retail presence = lower digital score) to align with the Blockbuster Index's focus on digital adoption.

**Technical Implementation:**

- REST API integration with Census Bureau endpoints.
- Fetches and processes demographic data.
- Data is stored in DynamoDB for historical tracking.

---

## Broadband Signal

**Purpose:**
Measures the quality and reach of broadband infrastructure, a key enabler of digital commerce.

**Data Source:**

- Broadband coverage data (percent of census blocks with broadband, high-speed, gigabit, and technology diversity).

**Calculation Method:**

- Weighted sum of:
  - 30%: Basic broadband availability (percent of blocks with any broadband)
  - 40%: High-speed availability (percent of blocks with 25+ Mbps)
  - 20%: Gigabit availability (percent of blocks with gigabit)
  - 10%: Technology diversity (fraction of 5 tech types present)
- **Formula:**
  Broadband Score = 0.3 × Basic + 0.4 × High-Speed + 0.2 × Gigabit + 0.1 × Diversity

**Normalization & Inversion:**

- Scores are normalized to a 0–100 scale (higher = better broadband, more digital adoption).
- No inversion is applied to this signal.

**Technical Implementation:**

- Data aggregation and processing from S3 and/or DynamoDB.
- Weighted calculation logic as described above.

---

## Walmart Signal

**Purpose:**
Provides a perspective on traditional retail employment patterns by tracking Walmart jobs, offering insights into the balance between traditional and digital retail infrastructure.

**Data Source:**

- Walmart Careers job board via web scraping.

**Calculation Method:**

- Scrapes Walmart store and Sam's Club job postings across all states.
  - Reflects traditional retail presence and employment patterns.

**Normalization & Inversion:**

- Scores are normalized to a 0–100 scale.
- Inverted after normalization (higher = more digital; fewer Walmart jobs means a higher score).

**Technical Implementation:**

- Puppeteer-based web scraping with anti-detection measures.
- Job category filtering and classification.
- Sliding window aggregation for the signal.
- Workforce normalization using Census data.
- Data stored in DynamoDB for historical tracking.

**Special Notes:**

- The Walmart signal is used as a component in the Blockbuster Index with its own weight (see WEIGHTS in the codebase). There is currently no single combined "Walmart Score"; only the normalized Walmart signal is incorporated into the overall index.

---

## Signal Inversion Logic

Some signals represent physical presence (e.g., retail establishments, physical jobs) and must be inverted after normalization so that higher values indicate lower digital adoption. The Blockbuster Index uses a configuration-driven approach to manage which signals are inverted. This is controlled by an `INVERTED_SIGNALS` array in the codebase, making it easy to add or remove inverted signals as needed. All signals listed in this array are automatically inverted after normalization during index calculation.

---

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
