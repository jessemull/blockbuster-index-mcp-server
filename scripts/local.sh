#!/bin/sh

docker build -t blockbuster-dev .
docker run --rm \
  -v ~/.aws:/root/.aws:ro \
  -e AMAZON_DYNAMODB_TABLE_NAME=blockbuster-index-amazon-jobs-dev \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_REGION=$AWS_REGION \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -e AWS_SESSION_TOKEN=$AWS_SESSION_TOKEN \
  -e CENSUS_DYNAMODB_TABLE_NAME=blockbuster-index-census-signals-dev \
  -e NODE_ENV=development \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  blockbuster-dev