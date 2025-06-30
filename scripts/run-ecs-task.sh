#!/bin/bash

# Usage: ./run-ecs-task.sh [dev|prod]
# Default environment is dev if not specified

ENVIRONMENT=${1:-dev}

if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
  echo "Error: Environment must be 'dev' or 'prod'"
  echo "Usage: $0 [dev|prod]"
  exit 1
fi

echo "🚀 Running blockbuster index calculation for $ENVIRONMENT environment..."

# Set cluster and task definition based on environment
if [[ "$ENVIRONMENT" == "prod" ]]; then
  CLUSTER="blockbuster-index-prod"
  TASK_DEF="blockbuster-index-task-prod"
else
  CLUSTER="blockbuster-index-dev"
  TASK_DEF="blockbuster-index-task-dev"
fi

# Run the ECS task
echo "Starting ECS task on cluster: $CLUSTER"
TASK_ARN=$(aws ecs run-task \
  --cluster $CLUSTER \
  --task-definition $TASK_DEF \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-02ce757a,subnet-2655df7b,subnet-e22085a8,subnet-badfdd91],securityGroups=[sg-09812900f87093af6],assignPublicIp=ENABLED}" \
  --query 'tasks[0].taskArn' \
  --output text)

if [[ $? -ne 0 ]]; then
  echo "❌ Failed to start ECS task"
  exit 1
fi

echo "✅ Started ECS task: $TASK_ARN"
echo "📊 Monitor the task at: https://us-west-2.console.aws.amazon.com/ecs/home?region=us-west-2#/clusters/$CLUSTER/tasks"
echo "📝 Check CloudWatch logs for detailed progress"
echo ""
echo "Task is running in background. Use Ctrl+C to exit this script (task will continue running)."

# Optional: Wait for completion (uncomment if you want to wait)
# echo "Waiting for task to complete..."
# aws ecs wait tasks-stopped --cluster $CLUSTER --tasks $TASK_ARN
# echo "Task completed. Check CloudWatch logs for results." 