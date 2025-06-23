#!/bin/sh

docker build -t blockbuster-dev .
docker run --rm -e OPENAI_API_KEY=$OPENAI_API_KEY -e NODE_ENV=development blockbuster-dev