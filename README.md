# Blockbuster Index MCP Server

The **Blockbuster Index MCP Server** calculates the **Blockbuster Index** for all U.S. states by aggregating multiple retail and digital commerce signals. Each signal runs as an independent ECS Fargate task on a daily schedule, fetching data from various retail APIs, computing weighted scores, and uploading the results to S3 for use by the **Blockbuster Index** website.

The **Blockbuster Index** is an AI-powered exploration of how consumer buying habits have shifted across the United States from traditional brick-and-mortar retail to online commerce. Inspired by the cultural decline of physical video rental stores like Blockbuster, this project builds a unique state-by-state index using signals that reflect the tension between digital and analog purchasing behavior.

This MCP server is part of the **Blockbuster Index Project** which includes the following repositories:

- **[Blockbuster Index MCP Server](https://github.com/jessemull/blockbuster-index-mcp-server)**: The **Blockbuster Index** calculation server (this repository).
- **[Blockbuster Index Project Client](https://github.com/jessemull/blockbuster-index)**: The **Blockbuster Index** NextJS client.
- **[Blockbuster Index Lambda@Edge](https://github.com/jessemull/blockbuster-index-lambda-at-edge)**: The **Blockbuster Index** Lambda@Edge.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Signal Calculations](#signal-calculations)
4. [Blockbuster Index Calculation](#blockbuster-index-calculation)
5. [ECS Task Scheduling](#ecs-task-scheduling)
6. [Environments](#environments)
7. [Tech Stack](#tech-stack)
8. [Setup Instructions](#setup-instructions)
9. [Running Signals Locally](#running-signals-locally)
10. [Development Workflow](#development-workflow)
11. [Commits & Commitizen](#commits--commitizen)
    - [Making a Commit](#making-a-commit)
12. [Linting & Formatting](#linting--formatting)
    - [Linting Commands](#linting-commands)
    - [Formatting Commands](#formatting-commands)
    - [Pre-Commit Hook](#pre-commit-hook)
13. [Unit Tests & Code Coverage](#unit-tests--code-coverage)
    - [Unit Tests](#unit-tests)
    - [Code Coverage](#code-coverage)
14. [Error & Performance Monitoring](#error--performance-monitoring)
    - [Configuration](#configuration)
    - [CloudWatch Logging](#cloudwatch-logging)
15. [Environment Variables](#environment-variables)
16. [Build & Deployment](#build--deployment)
    - [Build Process](#build-process)
    - [Docker Container](#docker-container)
    - [ECS Deployment](#ecs-deployment)
17. [Infrastructure](#infrastructure)
    - [CloudFormation](#cloudformation)
    - [Task Definitions](#task-definitions)
18. [Connecting to the Bastion Host](#connecting-to-the-bastion-host)
    - [Environment Variables](#environment-variables-2)
19. [License](#license)

## Project Overview

This project calculates the **Blockbuster Index** by aggregating distinct retail footprint signals for each U.S. state. The server fetches data from various retail APIs, applies weighted calculations, and uploads the results to S3 for use by the **Blockbuster Index** website.

The calculation process currently includes the following signals with more signals on the way:

- **Amazon** – E-commerce adoption and digital retail presence through job posting analysis.
- **Census** – Demographic and economic indicators from U.S. Census Bureau data.
- **Broadband** – Internet infrastructure and connectivity metrics.

Each signal is weighted and combined to generate a comprehensive score that reflects the balance between digital and physical retail activity in each state.

## Architecture Overview

The Blockbuster Index MCP Server employs a **modular microservices architecture** where each signal runs as an independent ECS Fargate task. This design provides several key advantages:

### Modular Signal Processing

- **Independent Deployment**: Each signal can be deployed, updated, and scaled independently.
- **Fault Isolation**: A failure in one signal doesn't affect the others.
- **Resource Optimization**: Each task can be configured with appropriate CPU/memory for its specific workload.
- **Parallel Execution**: Signals can run concurrently, reducing total processing time.

### Task Architecture

- **Amazon Signal Task**: Web scraping and job posting analysis.
- **Census Signal Task**: Demographic data processing and analysis.
- **Broadband Signal Task**: Infrastructure and connectivity metrics.
- **Blockbuster Index Task**: Signal aggregation and final index calculation.

### Data Flow

1. **Signal Collection**: Each signal task fetches and processes its respective data.
2. **S3 Storage**: Individual signal results are uploaded to S3 with versioned filenames.
3. **Index Calculation**: The blockbuster index task downloads all signal results and computes the final index.
4. **Result Publication**: Final index is uploaded to S3 for consumption by the website.

## Signal Calculations

### Amazon Signal

The Amazon signal measures e-commerce adoption and digital retail presence by analyzing job posting patterns across all U.S. states.

**Data Source**

- Amazon job postings via web scraping.

**Calculation Method**:

- Scrapes job postings for each state using Puppeteer.
- Counts total job postings per state.
- Normalizes by state population to account for size differences.
- Applies logarithmic scaling to handle outliers.
- Generates a score from 0-100 where higher scores indicate greater e-commerce activity.

**Technical Implementation**:

- Uses Puppeteer for dynamic content scraping.
- Implements retry logic with exponential backoff.
- Handles rate limiting and anti-bot measures.
- Processes results in parallel for efficiency.

### Census Signal

The Census signal captures demographic and economic indicators that correlate with retail behavior patterns.

**Data Source**:

- U.S. Census Bureau API.

**Calculation Method**:

- Fetches demographic data including population density, median income, and age distribution.
- Analyzes economic indicators such as employment rates and industry composition.
- Computes urbanization metrics and household characteristics.
- Normalizes data across states and applies statistical weighting.
- Generates a score from 0-100 reflecting retail market maturity.

**Technical Implementation**:

- REST API integration with Census Bureau endpoints.
- Statistical normalization using z-score methodology.
- Multi-factor analysis with configurable weights.
- Caching layer for API response optimization.

### Broadband Signal

The Broadband signal measures internet infrastructure quality and connectivity, which directly impacts e-commerce adoption.

**Data Source**:

- FCC broadband availability data.

**Calculation Method**:

- Analyzes broadband availability and speed metrics by state.
- Evaluates infrastructure quality and coverage percentages.
- Considers both fixed and mobile broadband penetration.
- Normalizes by geographic area and population density.
- Generates a score from 0-100 where higher scores indicate better connectivity.

**Technical Implementation**:

- S3-based data loading from FCC datasets.
- Geographic data processing and aggregation.
- Statistical analysis of coverage patterns.
- Performance optimization for large datasets.

## Blockbuster Index Calculation

The Blockbuster Index combines signals using a sophisticated weighted aggregation algorithm that reflects the relative importance of each factor in determining retail behavior patterns.

### Weighting System

- **Amazon Signal**: 40% weight - Direct measure of e-commerce activity.
- **Census Signal**: 30% weight - Demographic and economic foundation.
- **Broadband Signal**: 30% weight - Infrastructure enabling factor.

### Calculation Algorithm

1. **Signal Normalization**: All signals are normalized to a 0-100 scale.
2. **Weighted Aggregation**: Each signal is multiplied by its respective weight.
3. **State-by-State Calculation**: The weighted sum is computed for each state.
4. **Final Index**: Results in a 0-100 Blockbuster Index score per state.

### Interpretation

- **Higher Scores (70-100)**: States with strong digital retail adoption and modern consumer behavior.
- **Medium Scores (30-70)**: States in transition between traditional and digital retail.
- **Lower Scores (0-30)**: States maintaining traditional retail patterns.

## ECS Task Scheduling

The system employs a sophisticated scheduling architecture using AWS EventBridge to orchestrate the execution of all signals and the final index calculation.

### Execution Schedule

- **Signal Tasks**: Run daily at staggered intervals to avoid resource contention.
- **Blockbuster Index Task**: Runs daily after all signals complete.

### Task Dependencies

The scheduling system ensures proper execution order:

1. All signal tasks run independently and in parallel.
2. Each signal uploads its results to S3 upon completion.
3. The blockbuster index task waits for all signal results before executing.
4. Final index is published to S3 for website consumption.

### Error Handling

- **Retry Logic**: Failed tasks are automatically retried with exponential backoff.
- **Dead Letter Queues**: Failed executions are captured for manual review.
- **Monitoring**: CloudWatch alarms trigger on task failures.
- **Rollback Capability**: Previous versions can be quickly restored.

## Environments

The **Blockbuster Index** operates in multiple environments to ensure smooth development, testing, and production workflows. Configuration files and environment variables should be set to point to the correct environment (dev/prod), depending on the stage of the application. Separate cloudfront distributions exist for each environment.

## Tech Stack

The **Blockbuster Index MCP Server** is built using modern technologies to ensure reliability, scalability, and maintainability.

- **AWS ECS Fargate**: Containerized deployment platform that runs each signal as an independent scheduled task without managing servers.

- **AWS CloudFormation**: Infrastructure as Code (IaC) is used to define and provision AWS resources like ECS tasks, EventBridge rules, and IAM roles.

- **AWS EventBridge**: Triggers scheduled executions of each signal and the index combiner with precise timing and dependency management.

- **AWS S3**: Stores the calculated signal data and final index for consumption by the website, ensuring high availability and durability.

- **AWS CloudWatch**: Provides logging and monitoring capabilities for all tasks, including structured logging with bunyan.

- **Docker**: Containerization technology used to package each signal for consistent deployment across environments.

- **Webpack**: Bundles the TypeScript code for production deployment with optimization and minification.

- **Jest**: JavaScript testing framework used for unit and integration testing, ensuring code reliability and preventing regressions.

- **ESLint & Prettier**: Linting and formatting tools that enforce code consistency, reduce syntax errors, and improve maintainability.

- **Commitizen**: A tool for enforcing a standardized commit message format, improving version control history and making collaboration more structured.

- **Husky & Lint-Staged**: Git hooks that ensure code quality by running linting and formatting before commits.

- **Bunyan**: Structured logging library that provides JSON-formatted logs for better parsing and analysis.

- **AWS SDK v3**: Modern AWS SDK for JavaScript that provides type-safe access to AWS services like S3.

- **TypeScript**: Provides type safety and enhanced developer experience for the server codebase.

- **Node.js**: Runtime environment for executing the server application.

- **Puppeteer**: Headless browser automation for web scraping Amazon job postings.

This tech stack ensures that the **Blockbuster Index MCP Server** remains performant, secure, and easily maintainable while leveraging AWS infrastructure for scalability and reliability.

## Setup Instructions

To clone the repository, install dependencies, and run the project locally follow these steps:

1. Clone the repository:

   ```bash
   git clone https://github.com/jessemull/blockbuster-index-mcp-server.git
   ```

2. Navigate into the project directory:

   ```bash
   cd blockbuster-index-mcp-server
   ```

3. Install the dependencies:

   ```bash
   npm install
   ```

4. Set up environment variables. Please see the [Environment Variables](#environment-variables) section.

5. Run individual signals locally:

   ```bash
   npm run signal:amazon
   npm run signal:census
   npm run signal:broadband
   ```

## Running Signals Locally

### Individual Signal Execution

In development mode, signals write results to local files instead of S3. To run each signal independently for development and testing:

```bash
npm run signal -- <signalName>
```

### Container-Based Testing

To test signals in a containerized environment that mirrors production:

```bash
npm run signal:container -- <signalName>
```

### ECS Task Management

Tasks can be triggered manually from the command line. To trigger a specific task:

```bash
npm run ecs:run -- <signalName>
```

To run all tasks:

```bash
npm run ecs:run:all
```

### Build Process

Each task is built with a shared webpack configuration. To build a specific signal set the signal type environment variable:

```bash
SIGNAL_TYPE=<signalName> npm run build
```

## Commits & Commitizen

This project uses **Commitizen** to ensure commit messages follow a structured format and versioning is consistent. Commit linting is enforced via a pre-commit husky hook.

### Making a Commit

To make a commit in the correct format, run the following command. Commitzen will walk the user through the creation of a structured commit message and versioning:

```bash
npm run commit
```

## Linting & Formatting

This project uses **ESLint** and **Prettier** for code quality enforcement. Linting is enforced during every CI/CD pipeline to ensure consistent standards.

### Linting Commands

Run linting:

```bash
npm run lint
```

Fix linting issues automatically:

```bash
npm run lint:fix
```

### Formatting Commands

Format using prettier:

```bash
npm run format
```

Check formatting:

```bash
npm run format:check
```

### Pre-Commit Hook

**Lint-staged** is configured to run linting before each commit. The commit will be blocked if linting fails, ensuring code quality at the commit level.

## Unit Tests & Code Coverage

### Unit Tests

This project uses **Jest** for testing. Code coverage is enforced during every CI/CD pipeline. The build will fail if any tests fail or coverage drops below **92%**.

Run tests:

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Open coverage report:

```bash
npm run coverage:open
```

### Code Coverage

Coverage thresholds are enforced at **92%** for all metrics. The build will fail if coverage drops below this threshold.

## Error & Performance Monitoring

This project uses **AWS CloudWatch** for server-side error and performance monitoring with structured logging.

### Configuration

CloudWatch logging is configured with environment-specific settings. Logs are sent to CloudWatch with structured JSON formatting for better parsing and analysis.

### CloudWatch Logging

The server uses **Bunyan** for structured logging with the following features:

- **JSON-formatted logs** for better parsing and analysis.
- **Performance metrics** for tracking calculation times.
- **Signal-specific logging** for monitoring individual signal performance.
- **Error context** for debugging and monitoring.
- **CloudWatch integration** for centralized log management.

## Environment Variables

The following environment variables must be set in a `.env` file in the root of the project:

### Core Configuration

| Variable         | Description                                      |
| ---------------- | ------------------------------------------------ |
| `AWS_REGION`     | AWS region for S3 and CloudWatch operations.     |
| `CACHE_CONTROL`  | Cache control header for S3 uploads.             |
| `CW_LOG_GROUP`   | CloudWatch log group name.                       |
| `CW_LOG_STREAM`  | CloudWatch log stream name.                      |
| `LOG_LEVEL`      | Logging level (debug, info, warn, error).        |
| `NODE_ENV`       | Environment (development, production).           |
| `OPENAI_API_KEY` | OpenAI API key for AI-powered signal processing. |
| `S3_BUCKET_NAME` | S3 bucket name for data uploads.                 |

### AWS Infrastructure

| Variable                        | Description                                   |
| ------------------------------- | --------------------------------------------- |
| `AWS_TASK_ID`                   | ECS task ID for CloudWatch log stream naming. |
| `BROADBAND_S3_BUCKET`           | S3 bucket for broadband data storage.         |
| `BROADBAND_DYNAMODB_TABLE_NAME` | DynamoDB table for broadband signal data.     |
| `CENSUS_DYNAMODB_TABLE_NAME`    | DynamoDB table for census signal data.        |
| `AMAZON_DYNAMODB_TABLE_NAME`    | DynamoDB table for Amazon signal data.        |

### Signal Processing

| Variable                    | Description                                                           |
| --------------------------- | --------------------------------------------------------------------- |
| `SIGNAL_TYPE`               | Type of signal to run (amazon, census, broadband, blockbuster-index). |
| `FORCE_REFRESH`             | Force refresh flag for census data (true/false).                      |
| `MAX_RETRIES`               | Maximum retry attempts for API calls (default: 3).                    |
| `RETRY_DELAY`               | Delay between retry attempts in milliseconds (default: 1000).         |
| `PUPPETEER_EXECUTABLE_PATH` | Path to Puppeteer executable for web scraping.                        |

## Deployment

### Docker Container

The application is containerized using Docker for consistent deployment. A shared Dockerfile is used with a signal type environment variable set to indicate which signal and ECS task to build.

## Infrastructure

### CloudFormation

Infrastructure is managed using AWS CloudFormation templates:

- **`blockbuster-index-task-definition.yaml`**: Defines ECS task definitions and scheduled execution rules for all signals.
- **`blockbuster-index-cluster.yaml`**: Defines the ECS cluster and related resources.
- **`blockbuster-index-dynamo-db.yaml`**: Defines DynamoDB tables for data storage.
- **`blockbuster-index-broadband-s3.yaml`**: Defines S3 buckets for data storage.

### Task Definitions

Each signal has its own ECS task definition with optimized resource allocation:

- **Amazon Task**: Higher CPU allocation for web scraping operations
- **Census Task**: Balanced CPU/memory for API processing
- **Broadband Task**: Optimized for large dataset processing
- **Blockbuster Index Task**: Lightweight aggregation and calculation

## Connecting to the Bastion Host

To connect to the AWS EC2 bastion host and access AWS resources, you can use the following command:

```bash
npm run bastion
```

### Environment Variables

The following environment variables must be set in a `.env` file in the root of the project:

| Variable               | Description                               |
| ---------------------- | ----------------------------------------- |
| `SSH_HOST`             | The bastion host IP.                      |
| `SSH_PRIVATE_KEY_PATH` | Path to the bastion host private SSH key. |
| `SSH_USER`             | The bastion host username.                |

Ensure you have the appropriate permissions set on your SSH key for secure access.

## License

    Apache License
    Version 2.0, January 2004
    http://www.apache.org/licenses/

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

---
