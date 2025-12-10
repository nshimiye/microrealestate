#!/bin/bash

# Script to verify DynamoDB Global Secondary Indexes are active

set -e

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Default values (local development mode)
TABLE_NAME="${DYNAMODB_TABLE_NAME:-microrealestate-local}"
REGION="${DYNAMODB_REGION:-us-east-1}"
ENDPOINT="${DYNAMODB_ENDPOINT:-http://localhost:8000}"

# Set dummy credentials for local development if not already set
if [ -z "$AWS_ACCESS_KEY_ID" ]; then
  export AWS_ACCESS_KEY_ID=local
  export AWS_SECRET_ACCESS_KEY=local
fi

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --table-name)
      TABLE_NAME="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    --endpoint)
      ENDPOINT="$2"
      shift 2
      ;;
    --aws)
      ENDPOINT=""
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --table-name NAME    Table name (default: from DYNAMODB_TABLE_NAME or microrealestate-local)"
      echo "  --region REGION      AWS region (default: from DYNAMODB_REGION or us-east-1)"
      echo "  --endpoint URL       DynamoDB endpoint (default: http://localhost:8000)"
      echo "  --aws                Use AWS DynamoDB instead of local"
      echo "  --help               Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Build endpoint argument
ENDPOINT_ARG=""
if [ -n "$ENDPOINT" ]; then
  ENDPOINT_ARG="--endpoint-url $ENDPOINT"
fi

echo "Checking Global Secondary Indexes..."
echo "  Table name: $TABLE_NAME"
echo "  Region: $REGION"
if [ -n "$ENDPOINT" ]; then
  echo "  Endpoint: $ENDPOINT"
fi
echo ""

# Get GSI status
GSI_INFO=$(aws dynamodb describe-table \
  --table-name "$TABLE_NAME" \
  --region "$REGION" \
  $ENDPOINT_ARG \
  --query 'Table.GlobalSecondaryIndexes[*].[IndexName,IndexStatus,ItemCount]' \
  --output text 2>/dev/null)

if [ -z "$GSI_INFO" ]; then
  echo "✗ No Global Secondary Indexes found!"
  exit 1
fi

# Check each index
ALL_ACTIVE=true

echo "$GSI_INFO" | while IFS=$'\t' read -r INDEX_NAME INDEX_STATUS ITEM_COUNT; do
  if [ "$INDEX_STATUS" = "ACTIVE" ]; then
    echo "✓ $INDEX_NAME: $INDEX_STATUS (Items: $ITEM_COUNT)"
  else
    echo "✗ $INDEX_NAME: $INDEX_STATUS (Items: $ITEM_COUNT)"
    ALL_ACTIVE=false
  fi
done

# Detailed check for required indexes
EMAIL_INDEX_STATUS=$(echo "$GSI_INFO" | grep "EmailIndex" | awk '{print $2}')
CONTACT_EMAIL_INDEX_STATUS=$(echo "$GSI_INFO" | grep "ContactEmailIndex" | awk '{print $2}')

echo ""

if [ "$EMAIL_INDEX_STATUS" = "ACTIVE" ] && [ "$CONTACT_EMAIL_INDEX_STATUS" = "ACTIVE" ]; then
  echo "✓ All required indexes are ACTIVE!"
  echo ""
  echo "Your DynamoDB table is ready to use."
  exit 0
else
  echo "✗ Some indexes are not active yet."
  echo ""
  echo "Index creation can take several minutes. Please wait and try again."
  echo "You can monitor progress with: watch -n 5 ./scripts/dynamodb/confirm-indexes.sh"
  exit 1
fi
