# Blockbuster Index MCP Server

The **Blockbuster Index MCP Server** calculates the **Blockbuster Index** for all U.S. states by aggregating multiple retail footprint signals. It runs as an ECS Fargate task on a daily schedule, fetching data from various retail APIs, computing weighted scores, and uploading the results to S3 for use by the **Blockbuster Index** website.

The **Blockbuster Index** is an AI-powered exploration of how consumer buying habits have shifted across the United States—from traditional brick-and-mortar retail to online commerce. Inspired by the cultural decline of physical video rental stores like Blockbuster, this project builds a unique state-by-state index using signals that reflect the tension between digital and analog purchasing behavior.

This repository is part of the **Blockbuster Index Project** which includes the following repositories:

- **[Blockbuster Index MCP Server](https://github.com/jessemull/blockbuster-index-mcp-server)**: The **Blockbuster Index** calculation server (this repository).
- **[Blockbuster Index Project Client](https://github.com/jessemull/blockbuster-index)**: The **Blockbuster Index** NextJS client.
- **[Blockbuster Index Lambda@Edge](https://github.com/jessemull/blockbuster-index-lambda-at-edge)**: The **Blockbuster Index** Lambda@Edge.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Environments](#environments)
3. [Tech Stack](#tech-stack)
4. [Setup Instructions](#setup-instructions)
5. [Running Individual Signals](#running-individual-signals)
6. [Commits & Commitizen](#commits--commitizen)
   - [Making a Commit](#making-a-commit)
7. [Linting & Formatting](#linting--formatting)
   - [Linting Commands](#linting-commands)
   - [Formatting Commands](#formatting-commands)
   - [Pre-Commit Hook](#pre-commit-hook)
8. [Unit Tests & Code Coverage](#unit-tests--code-coverage)
   - [Unit Tests](#unit-tests)
   - [Code Coverage](#code-coverage)
9. [Error & Performance Monitoring](#error--performance-monitoring)
   - [Configuration](#configuration)
   - [CloudWatch Logging](#cloudwatch-logging)
10. [Environment Variables](#environment-variables)
11. [Running Locally w/ Docker](#running-locally-w-docker)
12. [Build & Deployment](#build--deployment)
    - [Environment Variables](#environment-variables-1)
    - [Build Process](#build-process)
    - [Docker Container](#docker-container)
13. [Infrastructure](#infrastructure)
    - [CloudFormation](#cloudformation)
    - [Scheduled Execution](#scheduled-execution)
14. [Connecting to the Bastion Host](#connecting-to-the-bastion-host)
    - [Environment Variables](#environment-variables-2)
15. [License](#license)

## Project Overview

This project calculates the **Blockbuster Index** by aggregating seven different retail footprint signals for each U.S. state. The server fetches data from various retail APIs, applies weighted calculations, and uploads the results to S3 for use by the **Blockbuster Index** website.

The calculation process includes the following signals:

- **Amazon** – E-commerce adoption and digital retail presence.
- **Analog** – Traditional retail and physical store metrics.
- **Broadband** – Internet infrastructure and connectivity.
- **E-commerce** – Online shopping adoption rates.
- **Physical** – Brick-and-mortar retail presence.
- **Streaming** – Digital media consumption patterns.
- **Walmart** – Traditional retail giant footprint.

Each signal is weighted and combined to generate a comprehensive score that reflects the balance between digital and physical retail activity in each state.

## Environments

The **Blockbuster Index** operates in multiple environments to ensure smooth development, testing, and production workflows. Configuration files and environment variables should be set to point to the correct environment (dev/prod), depending on the stage of the application. Separate cloudfront distributions exist for each environment.

## Tech Stack

The **Blockbuster Index MCP Server** is built using modern technologies to ensure reliability, scalability, and maintainability.

- **AWS ECS Fargate**: Containerized deployment platform that runs the server as a scheduled task without managing servers.

- **AWS CloudFormation**: Infrastructure as Code (IaC) is used to define and provision AWS resources like ECS tasks, EventBridge rules, and IAM roles.

- **AWS EventBridge**: Triggers scheduled executions of the server to refresh data periodically (daily by default).

- **AWS S3**: Stores the calculated index data for consumption by the website, ensuring high availability and durability.

- **AWS CloudWatch**: Provides logging and monitoring capabilities for the server, including structured logging with bunyan.

- **Docker**: Containerization technology used to package the application for consistent deployment across environments.

- **Webpack**: Bundles the TypeScript code for production deployment with optimization and minification.

- **Jest**: JavaScript testing framework used for unit and integration testing, ensuring code reliability and preventing regressions.

- **ESLint & Prettier**: Linting and formatting tools that enforce code consistency, reduce syntax errors, and improve maintainability.

- **Commitizen**: A tool for enforcing a standardized commit message format, improving version control history and making collaboration more structured.

- **Husky & Lint-Staged**: Git hooks that ensure code quality by running linting and formatting before commits.

- **Bunyan**: Structured logging library that provides JSON-formatted logs for better parsing and analysis.

- **AWS SDK v3**: Modern AWS SDK for JavaScript that provides type-safe access to AWS services like S3.

- **TypeScript**: Provides type safety and enhanced developer experience for the server codebase.

- **Node.js**: Runtime environment for executing the server application.

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

5. Run the server locally inside a docker container:

   ```bash
   npm run dev
   ```

## New Modular Architecture (2024 Refactor)

The Blockbuster Index MCP Server now runs each signal as a separate ECS task, with a dedicated entrypoint for each signal and for the index combiner. This enables independent deployment, scaling, and testing of each signal and the index calculation.

### Directory Structure

- `src/signals/amazon/entrypoint.ts` – Amazon signal ECS task entrypoint
- `src/signals/census/entrypoint.ts` – Census signal ECS task entrypoint
- `src/signals/broadband/entrypoint.ts` – Broadband signal ECS task entrypoint
- `src/calculate-index/entrypoint.ts` – Blockbuster index combiner ECS task entrypoint
- Shared code remains in `src/util/`, `src/types/`, and `src/constants/`

### Running Signals and Index Combiner

To run each signal or the index combiner locally:

```bash
npm run signal:amazon      # Run Amazon signal
npm run signal:census      # Run Census signal
npm run signal:broadband   # Run Broadband signal
npm run calculate-index      # Run the index combiner (after all signals have run)
```

Each signal writes its results to S3 (or to `dev/scores/` in development). The index combiner reads all signal outputs and produces the final Blockbuster Index.

### CI/CD and ECS

Each signal and the index combiner can be deployed and scheduled independently as ECS tasks. See the `.github/workflows/` directory and CloudFormation templates for details.

## Running Individual Signals

To test individual signals (legacy):

```bash
npm run signal
```

To test all signals (legacy):

```bash
npm run signal:all
```

To use the new modular scripts (recommended):

```bash
npm run signal:amazon
npm run signal:census
npm run signal:broadband
npm run calculate-index
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

This project uses **Jest** for testing. Code coverage is enforced during every CI/CD pipeline. The build will fail if any tests fail or coverage drops below **100%**.

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

Coverage thresholds are enforced at **100%** for all metrics. The build will fail if coverage drops below this threshold.

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

The following environment variables must be set in a `.env.local` file in the root of the project:

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

## Running Locally w/ Docker

To run the server in development mode:

```bash
npm run dev
```

Running the server locally will:

- Calculate the Blockbuster Index for all states.
- Write results to `dev/scores/blockbuster-index.json`.
- Log performance metrics and signal scores.

## Build & Deployment

### Environment Variables

The following environment variables must be set for production deployment:

| Variable         | Description                                     |
| ---------------- | ----------------------------------------------- |
| `AWS_REGION`     | AWS region for S3 and CloudWatch operations     |
| `LOG_LEVEL`      | Logging level for production                    |
| `OPENAI_API_KEY` | OpenAI API key for AI-powered signal processing |
| `S3_BUCKET_NAME` | S3 bucket name for data uploads                 |

### Build Process

To build the project for production:

```bash
npm run build
```

Building the server will:

- Compile TypeScript to JavaScript.
- Bundle the application with Webpack.
- Optimize and minify the code.
- Output to `dist/` directory.

### Docker Container

The application is containerized using Docker for consistent deployment.

To build the docker container:

```bash
docker build -t blockbuster-index-mcp-server .
```

To run the docker container:

```bash
docker run -e S3_BUCKET_NAME=your-bucket -e OPENAI_API_KEY=your-key blockbuster-index-mcp-server
```

## Infrastructure

### CloudFormation

Infrastructure is managed using AWS CloudFormation templates:

- **`blockbuster-index-task-definition.yaml`**: Defines the ECS task definition and scheduled execution rule.
- **`blockbuster-index-cluster.yaml`**: Defines the ECS cluster and related resources.

### Scheduled Execution

The server runs on a daily schedule using AWS EventBridge:

- **Schedule Expression**: once per day (configurable).
- **Target**: ECS Fargate task.
- **Network**: VPC with public IP assignment.
- **Security Groups**: Environment-specific security groups.

## Connecting to the Bastion Host

To connect to the AWS EC2 bastion host and access AWS resources, you can use the following command:

```bash
npm run bastion
```

### Environment Variables

The following environment variables must be set in a `.env.local` file in the root of the project:

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
