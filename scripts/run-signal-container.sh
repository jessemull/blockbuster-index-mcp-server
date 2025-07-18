#!/bin/sh

if [ -z "$1" ]; then
  echo "Please provide a signal name!"
  echo "Usage: npm run signal:container -- <signal-name>"
  echo "Available signals: amazon, broadband, census"
  exit 1
fi

SIGNAL_NAME=$1

echo "Building container for $SIGNAL_NAME"

docker build \
  --build-arg SIGNAL_TYPE=$SIGNAL_NAME \
  -t blockbuster-$SIGNAL_NAME .

echo "Running container for $SIGNAL_NAME"

docker run --rm \
  -v ~/.aws:/root/.aws:ro \
  --env-file .env \
  blockbuster-$SIGNAL_NAME
