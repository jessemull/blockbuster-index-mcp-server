#!/bin/bash

echo "Uploading BLS CSV files to S3..."

cd "BLS Data"

for file in *.csv; do
    echo "Uploading $file to S3..."
    aws s3 cp "$file" s3://blockbuster-index-bls-dev/
    echo "✅ $file uploaded"
done

echo "All BLS files uploaded to S3!" 