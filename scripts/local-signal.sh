#!/bin/sh

if [ -z "$1" ]; then
  echo "Please provide a signal name!"
  exit 1
fi

docker build -t blockbuster-dev .

docker run --rm \
  -v "$(pwd)":/app \
  -w /app \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e NODE_ENV=development \
  blockbuster-dev \
  npx ts-node dev/runners/$1.dev.ts