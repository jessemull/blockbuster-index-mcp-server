#!/bin/sh

docker build -t blockbuster-dev .
docker run --rm \
  -v ~/.aws:/root/.aws:ro \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e NODE_ENV=development \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -e AWS_SESSION_TOKEN=$AWS_SESSION_TOKEN \
  -e AWS_REGION=$AWS_REGION \
  blockbuster-dev