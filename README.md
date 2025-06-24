# Blockbuster Index MCP Server

A server that calculates a "Blockbuster Index" for each US state, measuring digital vs physical retail footprints and 90s nostalgia factors. The server runs as an ECS Fargate task that executes daily and uploads results to S3 for a NextJS static deployment.

## 🎯 Project Overview

The Blockbuster Index combines multiple signals to create a comprehensive score for each state:

- **Amazon** (10%): E-commerce penetration
- **Analog** (10%): Traditional/retro indicators
- **Broadband** (20%): Digital infrastructure
- **E-commerce** (20%): Online shopping adoption
- **Physical** (15%): Brick-and-mortar retail presence
- **Streaming** (15%): Digital media consumption
- **Walmart** (10%): Big-box retail presence

## 🚀 Recent Improvements

### 1. **Enhanced Type Safety**

- Added comprehensive TypeScript interfaces for response structures
- Improved type definitions for all data structures
- Better error handling with typed error objects

### 2. **Configuration Management**

- Centralized configuration in `src/constants/index.ts`
- Environment variable validation
- Configurable retry logic and timeouts

### 3. **Error Handling & Resilience**

- Exponential backoff retry logic for all external calls
- Comprehensive error logging with context
- Graceful degradation for partial failures

### 4. **Structured Logging**

- Enhanced logger with performance metrics
- Structured JSON logging for better observability
- CloudWatch integration for production environments
- Custom log methods for different operation types

### 5. **Health Monitoring**

- Built-in health checker with memory and uptime monitoring
- Performance metrics collection
- Health status reporting

### 6. **S3 Integration Improvements**

- Better error handling for S3 operations
- Configurable cache control headers
- Metadata support for versioning and tracking

## 📁 Project Structure

```
src/
├── constants/          # Configuration and weights
├── signals/           # Individual signal calculations
├── types/             # TypeScript type definitions
├── util/              # Utilities (logger, S3, health)
└── index.ts           # Main application logic
```

## 🛠️ Development

### Prerequisites

- Node.js 20+
- AWS CLI configured
- Docker (for containerization)

### Local Development

```bash
# Install dependencies
npm install

# Set up environment variables (see ENVIRONMENT.md)
cp ENVIRONMENT.md .env
# Edit .env with your local values

# Run in development mode (writes to local files)
npm run dev

# Run all signals individually
npm run signal:all

# Run specific signal
npm run signal

# Run tests
npm test

# Build for production
npm run build
```

### Environment Variables

See [ENVIRONMENT.md](ENVIRONMENT.md) for detailed information about environment variables.

**Quick Setup for Local Development:**

```bash
# Create .env file with development settings
NODE_ENV=development
AWS_REGION=us-west-2
S3_BUCKET_NAME=blockbuster-index-client-dev
LOG_LEVEL=debug
MAX_RETRIES=3
RETRY_DELAY=1000
CACHE_CONTROL=max-age=300
```

## 🐳 Docker & Deployment

### Building the Container

```bash
docker build -t blockbuster-index .
```

### ECS Deployment

The project includes CloudFormation templates for ECS deployment:

- `cloudformation/blockbuster-index-cluster.yaml` - ECS cluster setup
- `cloudformation/blockbuster-index-task-definition.yaml` - Task definition and scheduling

**Environment-specific configuration is handled automatically:**

- Dev environment: `blockbuster-index-client-dev` S3 bucket, `info` log level
- Prod environment: `blockbuster-index-client-prod` S3 bucket, `warn` log level

### Scheduled Execution

The ECS task is configured to run daily via EventBridge, but you can customize the schedule:

```yaml
ScheduleExpression: "rate(1 day)"  # Daily at midnight UTC
# or
ScheduleExpression: "cron(0 6 * * ? *)"  # Daily at 6 AM UTC
```

## 📊 Output Format

The server generates a structured JSON response:

```json
{
  "states": {
    "CA": {
      "score": 0.75,
      "components": {
        "AMAZON": 0.1,
        "ANALOG": 0.05,
        "BROADBAND": 0.2,
        "ECOMMERCE": 0.2,
        "PHYSICAL": 0.15,
        "STREAMING": 0.15,
        "WALMART": 0.1
      }
    }
  },
  "metadata": {
    "calculatedAt": "2024-01-15T10:30:00.000Z",
    "version": "1.0.0",
    "totalStates": 50
  }
}
```

## 🔍 Monitoring & Observability

### Logging

- Structured JSON logs for easy parsing
- Performance metrics for each operation
- Error tracking with full context
- CloudWatch integration in production

### Health Checks

- Memory usage monitoring
- Uptime tracking
- Custom health check registration
- Performance metrics collection

### Metrics

- Processing time per state
- Signal calculation performance
- S3 upload/download metrics
- Error rates and retry attempts

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

The test suite includes:

- Unit tests for all signal calculations
- Integration tests for the main function
- Error handling scenarios
- Configuration validation

## 🔧 Configuration

### Signal Weights

Adjust the importance of each signal in `src/constants/weights.ts`:

```typescript
export const WEIGHTS: Record<Signal, number> = {
  [Signal.AMAZON]: 0.1,
  [Signal.ANALOG]: 0.1,
  [Signal.BROADBAND]: 0.2,
  [Signal.ECOMMERCE]: 0.2,
  [Signal.PHYSICAL]: 0.15,
  [Signal.STREAMING]: 0.15,
  [Signal.WALMART]: 0.1,
};
```

### Environment Configuration

Most configuration is handled automatically through environment variables. See [ENVIRONMENT.md](ENVIRONMENT.md) for details.

## 🚨 Error Handling

The application includes comprehensive error handling:

1. **Retry Logic**: Exponential backoff for transient failures
2. **Graceful Degradation**: Continues processing even if some signals fail
3. **Detailed Logging**: Full error context and stack traces
4. **Health Monitoring**: Automatic health status reporting

## 📈 Performance

- **Parallel Processing**: All signals are fetched concurrently
- **Efficient Memory Usage**: Streaming processing for large datasets
- **Optimized Build**: Webpack configuration for minimal bundle size
- **Caching**: Configurable cache headers for S3 objects

## 🔐 Security

- **IAM Roles**: Least privilege access for ECS tasks
- **Secrets Management**: AWS Secrets Manager for sensitive data
- **Network Security**: VPC configuration with security groups
- **Input Validation**: Type-safe data processing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
