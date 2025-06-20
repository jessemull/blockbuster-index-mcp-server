# Blockbuster Index MCP Lambda

The **Blockbuster Index Project** is a playful exploration of how consumer buying habits have shifted from traditional brick-and-mortar stores to digital purchases across the United States. Inspired by the nostalgic decline of physical video rental stores like Blockbuster, this project creates a unique index that scores each state based on various signals reflecting the balance of online versus in-person purchases.

The **Blockbuster Index** website visualizes these scores and trends, providing users with an engaging way to see how retail behaviors vary geographically, combining humor and data-driven insights.

This repository is part of the **Blockbuster Index Project** which includes the following repositories:

- **[Blockbuster Index MCP Lambda](https://github.com/jessemull/blockbuster-index-mcp-lambda)**: The **Blockbuster Index** MCP lambda.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Environments](#environments)
3. [Tech Stack](#tech-stack)
4. [Setup Instructions](#setup-instructions)
5. [SAM Local Invoke](#sam-local-invoke)
   - [Pre-Requisites](#pre-requisites)
   - [Running SAM Client Locally](#running-sam-client-locally)
6. [Commits and Commitizen](#commits-and-commitizen)
   - [Making A Commit](#making-a-commit)
7. [Linting & Formatting](#linting--formatting)
   - [Linting Commands](#linting-commands)
   - [Formatting Commands](#formatting-commands)
   - [Pre-Commit Hook](#pre-commit-hook)
8. [Testing & Code Coverage](#testing--code-coverage)
   - [Testing Commands](#testing-commands)
   - [Code Coverage](#code-coverage)
9. [Building & Packaging](#building--packaging)
   - [Summary](#summary)
   - [Install](#install)
   - [Build](#build)
   - [Package](#package)
10. [Deployment Pipelines](#deployment-pipelines)
    - [Deployment Strategy](#deployment-strategy)
    - [Tools Used](#tools-used)
    - [Pull Request](#pull-request)
    - [Deploy](#deploy)
    - [Merge](#merge)
    - [Rollback](#rollback)
11. [Connecting to the Bastion Host](#connecting-to-the-bastion-host)
    - [Environment Variables](#environment-variables)
12. [License](#license)

## Project Overview

This project implements the **Blockbuster Index MCP Lambda**, a data-processing function responsible for generating the **Blockbuster Index**, a state-by-state score reflecting the shift from traditional in-store retail to online consumer behavior. It supports a **Next.js** static website hosted on **S3** and served via **CloudFront**.

### Key Features

- **Model Context Protocol**: Periodically computes the **Blockbuster Index** for all U.S. states based on various signals (e.g., e-commerce adoption, physical retail trends).
- **Next.js Compatibility**: Outputs static JSON data consumable by the **Blockbuster Index** frontend at build time or via client fetches.
- **Cost-Efficient Architecture**: Designed to run on-demand or via scheduled execution using AWS Lambda and S3.

### **Authentication & Security**

- This function does **not** require authentication, as it is typically invoked via a secure internal process via **CloudWatch** events.
- The output is written to a secure S3 bucket served via CloudFront with optional public access through the static website.
- Rate limiting and WAF rules are applied if and when the dynamic endpoints are exposed.

## Environments

The **Blockbuster Index Project** operates in multiple environments to ensure smooth development, testing and production workflows. Configuration files and environment variables should be set to point to the correct environment (dev/prod) depending on the stage of the application. Separate CloudFront distributions exist for each environment.

## Tech Stack

This project leverages modern cloud infrastructure, AI models and TypeScript tooling to compute and serve the **Blockbuster Index**, a data-driven look at the transition from physical to digital retail in the U.S.

- **AWS Lambda**: Hosts the MCP (Model Context Protocol) server which powers AI-driven analysis and generates the **Blockbuster Index** by interacting with external signals and datasets.

- **AWS S3**: Stores the **Blockbuster Index** data as static JSON files, which are consumed by the frontend.

- **AWS CloudWatch Events**: Triggers scheduled executions of the MCP to refresh data periodically.

- **LLM Integration (OpenAI)**: Powers natural language reasoning, classification or synthesis of signals, interpreting economic indicators, summarizing trends or generating explanations.

- **External APIs**: Fetches supporting data such as retail foot traffic, e-commerce adoption rates or census statistics used to compute the index.

- **TypeScript**: Used across all lambda functions and build scripts for strong typing, maintainability and developer productivity.

- **Jest**: Provides robust testing for the MCP logic to ensure accurate calculations and error handling.

- **ESLint & Prettier**: Enforce consistent code style and catch issues early in development.

- **GitHub Actions**: Automates build, lint, test and deploy workflows to ensure reliable CI/CD.

- **Commitizen**: Standardizes commit messages for a clean and informative git history.

This stack enables the **Blockbuster Index Project** to integrate AI responsibly and effectively while staying scalable, low-cost and developer-friendly on AWS.

## Setup Instructions

To clone the repository and install dependencies follow these steps:

1. Clone the repository:

   ```bash
   git clone https://github.com/jessemull/blockbuster-index-mcp-lambda.git
   ```

2. Navigate into the project directory:

   ```bash
   cd blockbuster-index-mcp-lambda
   ```

3. Install the root dependencies:

   ```bash
   npm install
   ```

## SAM Local Invoke

The lambda can be run locally using the SAM client using a mock test event and a cloudformation template for local development.

### Pre-Requisites

1. Install docker desktop using your preferred runtime environment:

   [https://docs.docker.com/engine/install/](https://docs.docker.com/engine/install/)

2. Install the SAM client:

   ```bash
   brew install aws/tap/aws-sam-cli
   ```

### Running SAM Client Locally

1. Build and package the lambda:

   ```bash
   npm run sam:build
   ```

2. Invoke the lambda using the SAM client:

   ```bash
   npm run sam:invoke
   ```

## Commits and Commitizen

This project uses **Commitizen** to ensure commit messages follow a structured format and versioning is consistent. Commit linting is enforced via a pre-commit husky hook.

### Making a Commit

To make a commit in the correct format, run the following command. Commitzen will walk the user through the creation of a structured commit message and versioning:

```bash
npm run commit
```

## Testing & Code Coverage

This project uses **Jest** for testing. Code coverage is enforced during every CI/CD pipeline. The build will fail if any tests fail or coverage drops below **80%**.

### Testing Commands

Run tests:

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test:watch
```

### Code Coverage

Coverage thresholds are enforced at **80%** for all metrics. The build will fail if coverage drops below this threshold.

## Linting & Formatting

This project uses **ESLint** and **Prettier** for code quality enforcement. Linting is enforced during every CI/CD pipeline to ensure consistent standards.

### Linting Commands

Run linting:

```bash
npm run lint
```

Run linting with automatic fixes applied:

```bash
npm run lint:fix
```

### Formatting Commands

Format using prettier:

```bash
npm run format
```

### Pre-Commit Hook

**Lint-staged** is configured to run linting before each commit. The commit will be blocked if linting fails, ensuring code quality at the commit level.

## Building & Packaging

### Summary

The build command runs webpack and outputs the build artifacts into a `dist/` directory. Pre-build, a clean command removes the `dist` directory. Webpack performs minification but leaves the handler name intact so it remains discoverable by the AWS lambda service.

The package command zips the contents of the `dist/` folder for the lambda deployment. Before running a build, ensure you have dependencies installed.

### Install

To install dependencies:

```bash
npm install
```

### Build

To run the build:

```bash
npm run build
```

### Package

To package the application:

```bash
npm run package
```

## Deployment Pipelines

This project uses automated deployment pipelines to ensure a smooth and reliable deployment process utilizing AWS CloudFormation, GitHub Actions and S3.

### Deployment Strategy

Each deployment process involves:

- **Versioned Artifacts:** The function is bundled and uploaded as a zipped package to Amazon S3. The package is versioned using a unique artifact name, ensuring that each deployment has a distinct, traceable version.
- **CloudFormation:** AWS CloudFormation change sets are used to manage and deploy the lambda function. This tool allows us to define, update and roll back the infrastructure in a repeatable and consistent way.
- **Rollback:** Deployments can be rolled back to a prior version using previously stored S3 bundles.

### Tools Used

- **AWS CLI**: Configures the AWS environment for deployments.
- **GitHub Actions**: Automates and schedules the deployment and rollback pipelines.
- **CloudFormation**: Orchestrates infrastructure changes, including deployments and rollbacks.
- **S3**: Stores function packages for deployment and rollback.

### Pull Request

The pull request pipeline is triggered when a pull request is opened against the `main` branch. This pipeline performs the following steps:

1. **Build:** Builds and packages the lambda using webpack.
2. **Linting:** Runs linting checks.
3. **Testing:** Runs unit tests.
4. **Code Coverage:** Checks code coverage remains above 80%.

This pipeline is defined in the `.github/workflows/pull-request.yml` file.

### Deploy

The deploy pipeline is triggered manually via a workflow dispatch event, allowing deployment to dev/prod environments. This pipeline performs the following steps:

1. **Build:** Builds and packages the lambda using webpack.
2. **Linting:** Runs linting checks.
3. **Testing:** Runs unit tests.
4. **Code Coverage:** Checks code coverage remains above 80%.
5. **Artifact Generation:** Generates a versioned artifact name.
6. **S3 Upload:** Uploads the packaged lambda to S3.
7. **CloudFormation Deployment:** Creates, executes and monitors a change set.
8. **Backup Pruning:** Ensures only the latest five lambda package versions are stored in S3.

This pipeline is defined in the `.github/workflows/deploy-lambda.yml` file.

### Merge

The merge pipeline is triggered on a merged commit to main. It deploys the lambda to the development environment. This pipeline performs the following steps:

1. **Build:** Builds and packages the lambda using webpack.
2. **Linting:** Runs linting checks.
3. **Testing:** Run unit tests.
4. **Code Coverage:** Checks code coverage remains above 80%.
5. **Artifact Generation:** Generates a versioned artifact name.
6. **S3 Upload:** Uploads the packaged lambda to S3.
7. **CloudFormation Deployment:** Creates, executes and monitors a change set.
8. **Backup Pruning:** Ensures only the latest five lambda package versions are stored in S3.

This pipeline is defined in the `.github/workflows/merge.yml` file.

### Rollback

The rollback pipeline is triggered manually via a workflow dispatch event, allowing rollback of the lambda function to a previous version stored in S3. This pipeline performs the following steps:

1. **CloudFormation Deployment:** Creates, executes and monitors a change set.

## Connecting to the Bastion Host

To connect to the AWS EC2 bastion host and access AWS resources, you can use the following command:

```bash
npm run bastion
```

### Environment Variables

The following environment variables must be set in a `.env` file in the root of the project:

```
SSH_PRIVATE_KEY_PATH=/path/to/your/private/key
SSH_USER=your-ssh-username
SSH_HOST=your-ec2-instance-hostname-or-ip
```

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
