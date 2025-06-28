#!/bin/sh

if [ -z "$1" ]; then
  echo "Please provide a signal name!"
  exit 1
fi

docker build -t blockbuster-dev .

docker run --rm \
  -v "$(pwd)":/app \
  -v ~/.aws:/root/.aws:ro \
  -w /app \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e NODE_ENV=development \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -e AWS_SESSION_TOKEN=$AWS_SESSION_TOKEN \
  -e AWS_REGION=$AWS_REGION \
  blockbuster-dev \
  npx ts-node dev/runners/$1.dev.ts