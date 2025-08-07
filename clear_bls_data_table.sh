#!/bin/bash

echo "Clearing blockbuster-index-bls-state-data-dev table..."

# Get total count first
TOTAL_ITEMS=$(aws dynamodb scan --table-name blockbuster-index-bls-state-data-dev --select COUNT --query "Count" --output text)
echo "Total items to delete: $TOTAL_ITEMS"

# Delete in batches of 25 (DynamoDB batch delete limit)
BATCH_SIZE=25
DELETED=0

while [ $DELETED -lt $TOTAL_ITEMS ]; do
  # Get a batch of keys
  KEYS=$(aws dynamodb scan \
    --table-name blockbuster-index-bls-state-data-dev \
    --attributes-to-get "state_year" \
    --limit $BATCH_SIZE \
    --query "Items[*].state_year.S" \
    --output text | tr '\t' '\n')
  
  if [ -z "$KEYS" ]; then
    break
  fi
  
  # Create batch delete request
  BATCH_REQUEST="{\"RequestItems\":{\"blockbuster-index-bls-state-data-dev\":{\"Keys\":["
  
  FIRST=true
  for key in $KEYS; do
    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      BATCH_REQUEST="$BATCH_REQUEST,"
    fi
    BATCH_REQUEST="$BATCH_REQUEST{\"state_year\":{\"S\":\"$key\"}}"
  done
  
  BATCH_REQUEST="$BATCH_REQUEST]}}}"
  
  # Execute batch delete
  aws dynamodb batch-write-item --request-items "$BATCH_REQUEST" > /dev/null
  
  DELETED=$((DELETED + $(echo "$KEYS" | wc -l)))
  echo "Deleted $DELETED / $TOTAL_ITEMS items..."
done

echo "Table clearing completed!" 