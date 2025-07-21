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
    - [GitHub Workflows](#github-workflows)
    - [Infrastructure](#infrastructure)
17. [Connecting to the Bastion Host](#connecting-to-the-bastion-host)
    - [Environment Variables](#environment-variables-2)
18. [License](#license)

## Project Overview

This project calculates the **Blockbuster Index** by aggregating distinct retail footprint signals for each U.S. state. The server fetches data from various retail APIs, applies weighted calculations, and uploads the results to S3 for use by the **Blockbuster Index** website.

The calculation process currently includes the following signals with more signals on the way:

- **Amazon** – E-commerce adoption and digital retail presence through job posting analysis with sliding window aggregation for improved accuracy.
- **Census** – Retail market maturity using U.S. Census Bureau data: retail establishments per 100,000 population (establishment count / population × 100,000). Data is fetched via REST API integration, including establishment counts (NAICS 44-45), state population, and workforce size (used for normalization in other signals).
- **Broadband** – Internet infrastructure and connectivity metrics. Coverage is measured as the percentage of census blocks (not population or land area) with broadband service. The broadband score is a weighted sum: 30% basic broadband availability, 40% high-speed (25+ Mbps), 20% gigabit, 10% technology diversity. Weights emphasize high-speed and future-ready access while rewarding basic coverage and diversity.
- **Walmart** – Physical retail presence and technology job distribution through dual-signal analysis of Walmart job postings.

Each signal is weighted and combined to generate a comprehensive score that reflects the balance between digital and physical retail activity in each state.

## Architecture Overview

The Blockbuster Index MCP Server employs a **modular microservices architecture** where each signal runs as an independent ECS Fargate task. This design provides several key advantages:

### Modular Signal Processing

- **Independent Deployment**: Each signal can be deployed, updated, and scaled independently.
- **Fault Isolation**: A failure in one signal doesn't affect the others.
- **Resource Optimization**: Each task can be configured with appropriate CPU/memory for its specific workload.
- **Parallel Execution**: Signals can run concurrently, reducing total processing time.

### Task Architecture

- **Amazon Signal Task**: Web scraping and job posting analysis with sliding window aggregation.
- **Census Signal Task**: Demographic data processing and analysis.
- **Broadband Signal Task**: Infrastructure and connectivity metrics.
- **Walmart Signal Task**: Dual-signal job posting analysis for physical and technology roles.
- **Blockbuster Index Task**: Signal aggregation and final index calculation.

### Data Flow

1. **Signal Collection**: Each signal task fetches and processes its respective data.
2. **Data Persistence**: Signal-specific data is stored in DynamoDB tables (e.g., Amazon job data, sliding window aggregates).
3. **S3 Storage**: Individual signal results are uploaded to S3 with versioned filenames.
4. **Index Calculation**: The blockbuster index task downloads all signal results and computes the final index.
5. **Result Publication**: Final index is uploaded to S3 for consumption by the website.

## Signal Calculations

See [SIGNALS.md](SIGNALS.md) for detailed information about how each signal is calculated and how they are combined to create the Blockbuster Index.

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

- **AWS DynamoDB**: Provides persistent storage for signal-specific data including job posting records and sliding window aggregates, enabling efficient data processing and historical analysis.

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

## Development Workflow

The **Blockbuster Index MCP Server** follows a structured development workflow that ensures code quality, testing, and proper deployment practices.

### Development Process

1. **Feature Development**: Create feature branches from main for new functionality
2. **Local Testing**: Run signals locally using the provided npm scripts
3. **Code Quality**: Ensure all linting and formatting standards are met
4. **Unit Testing**: Write and run comprehensive unit tests with 92% coverage
5. **Pull Request**: Submit PR with proper commitizen-formatted commits
6. **CI/CD Pipeline**: Automated testing and quality checks via GitHub Actions
7. **Deployment**: Use GitHub workflows for targeted signal deployment

### Signal Development

When developing new signals or modifying existing ones:

1. **Local Development**: Use `npm run signal -- <signalName>` for local testing
2. **Container Testing**: Use `npm run signal:container -- <signalName>` for production-like testing
3. **ECS Testing**: Use `npm run ecs:run -- <signalName>` for AWS environment testing
4. **Deployment**: Use GitHub Actions deploy workflow for production deployment

### Code Standards

- **TypeScript**: All code must be written in TypeScript with proper type definitions
- **ESLint**: Code must pass all linting rules without warnings
- **Prettier**: Code must be properly formatted using Prettier
- **Jest**: All new code must include comprehensive unit tests
- **Coverage**: Maintain 92% minimum code coverage across all metrics

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

See [ENVIRONMENT.md](ENVIRONMENT.md) for a complete list of all environment variables used by the blockbuster index MCP server, organized by signal type and functionality.

## Build & Deployment

The **Blockbuster Index MCP Server** uses a sophisticated CI/CD pipeline with GitHub Actions to enable independent deployment of each signal. This modular approach allows for targeted updates and rollbacks without affecting the entire system.

### Build Process

Each signal is built using a shared webpack configuration with the `SIGNAL_TYPE` environment variable determining which signal to compile:

```bash
SIGNAL_TYPE=<signalName> npm run build
```

### Docker Container

The application is containerized using Docker for consistent deployment across environments. A shared Dockerfile is used with the `SIGNAL_TYPE` build argument to create signal-specific containers:

```dockerfile
ARG SIGNAL_TYPE
ENV SIGNAL_TYPE=$SIGNAL_TYPE
```

### GitHub Workflows

The project includes four GitHub Actions workflows that enable granular control over deployment and execution.

#### Deploy Workflow

Deploy individual signals to ECS Fargate with full CI/CD pipeline. Triggered manually from GitHub Actions UI with parameter selection.

**Process**:

1. **Code Quality Checks**: Runs linting and unit tests with 92% coverage threshold.
2. **Docker Build**: Creates signal-specific container image with versioned tag.
3. **ECR Push**: Uploads image to AWS ECR with environment-specific repository.
4. **CloudFormation Deployment**: Updates ECS task definition with new container image.
5. **Task Execution**: Automatically runs the deployed task to verify functionality.

#### Rollback Workflow

Quickly rollback a specific signal to a previous container image version. Triggered manually when issues are detected with a recent deployment.

**Process**:

1. **CloudFormation Update**: Deploys task definition with previous container image.
2. **Verification**: Ensures rollback completes successfully.

#### Run Task Workflow

Manually trigger execution of any signal task for testing or data refresh. Triggered manually for on-demand signal execution.

**Process**:

1. **Task Launch**: Executes ECS task with current task definition.
2. **Monitoring**: Provides task ARN for CloudWatch monitoring.

#### Pull Request Workflow

Automated quality gates for all pull requests. Automatically triggered on all pull requests to main branch.

**Process**:

1. **Build Verification**: Ensures code compiles correctly.
2. **Linting**: Enforces code style and quality standards.
3. **Unit Testing**: Runs comprehensive test suite with coverage reporting.
4. **Coverage Threshold**: Enforces 92% minimum coverage requirement.

### Infrastructure

#### CloudFormation Templates

Infrastructure is managed using AWS CloudFormation templates with environment-specific parameterization:

- **`blockbuster-index-task-definition.yaml`**: Defines ECS task definitions and scheduled execution rules for all signals with environment-specific configurations.
- **`blockbuster-index-cluster.yaml`**: Defines the ECS cluster, IAM roles, security groups, and related resources.
- **`blockbuster-index-dynamo-db.yaml`**: Defines DynamoDB tables for signal data storage with environment-specific naming.
- **`blockbuster-index-broadband-s3.yaml`**: Defines S3 buckets for broadband data storage.

#### Task Definitions

Each signal has its own ECS task definition with optimized resource allocation and environment-specific configurations:

- **Amazon Task**: Higher CPU allocation for web scraping operations with Puppeteer
- **Census Task**: Balanced CPU/memory for API processing and data analysis
- **Broadband Task**: Optimized for large dataset processing with S3 integration
- **Blockbuster Index Task**: Lightweight aggregation and calculation with minimal resource requirements

#### Environment Parameterization

All infrastructure components use environment-specific naming and configuration:

- **Resource Naming**: All AWS resources include environment prefix (e.g., `blockbuster-index-amazon-task-dev`)
- **Configuration Mapping**: Environment-specific settings for logging levels, S3 buckets, and DynamoDB tables
- **Security Groups**: Environment-specific network security configurations
- **Scheduling**: Environment-specific EventBridge rules for task execution

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
