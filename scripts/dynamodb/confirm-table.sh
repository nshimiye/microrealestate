#!/bin/bash

# Script to verify DynamoDB table exists and is properly configured

set -e

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Default values
TABLE_NAME="${DYNAMODB_TABLE_NAME:-microrealestate-local}"
REGION="${DYNAMODB_REGION:-us-east-1}"
ENDPOINT="${DYNAMODB_ENDPOINT:-}"

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
    --local)
      ENDPOINT="http://localhost:8000"
      TABLE_NAME="microrealestate-local"
      export AWS_ACCESS_KEY_ID=local
      export AWS_SECRET_ACCESS_KEY=local
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --table-name NAME    Table name (default: from DYNAMODB_TABLE_NAME or microrealestate-local)"
      echo "  --region REGION      AWS region (default: from DYNAMODB_REGION or us-east-1)"
      echo "  --endpoint URL       DynamoDB endpoint (default: from DYNAMODB_ENDPOINT)"
      echo "  --local              Use local DynamoDB (sets endpoint to localhost:8000)"
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

echo "Verifying DynamoDB table..."
echo "  Table name: $TABLE_NAME"
echo "  Region: $REGION"
if [ -n "$ENDPOINT" ]; then
  echo "  Endpoint: $ENDPOINT"
fi
echo ""

# Check if table exists
if ! aws dynamodb describe-table \
  --table-name "$TABLE_NAME" \
  --region "$REGION" \
  $ENDPOINT_ARG \
  > /dev/null 2>&1; then
  echo "✗ Table '$TABLE_NAME' does not exist!"
  echo ""
  echo "Create it with: ./scripts/dynamodb/create-table.sh"
  exit 1
fi

echo "✓ Table exists"

# Get table details
TABLE_INFO=$(aws dynamodb describe-table \
  --table-name "$TABLE_NAME" \
  --region "$REGION" \
  $ENDPOINT_ARG)

# Extract key information
TABLE_STATUS=$(echo "$TABLE_INFO" | grep -o '"TableStatus": "[^"]*"' | cut -d'"' -f4)
BILLING_MODE=$(echo "$TABLE_INFO" | grep -o '"BillingModeSummary": {[^}]*}' | grep -o '"BillingMode": "[^"]*"' | cut -d'"' -f4 || echo "PROVISIONED")
ITEM_COUNT=$(echo "$TABLE_INFO" | grep -o '"ItemCount": [0-9]*' | cut -d' ' -f2)

echo "✓ Table status: $TABLE_STATUS"
echo "✓ Billing mode: $BILLING_MODE"
echo "✓ Item count: $ITEM_COUNT"

# Check key schema
PK_EXISTS=$(echo "$TABLE_INFO" | grep -c '"AttributeName": "PK"' || echo "0")
SK_EXISTS=$(echo "$TABLE_INFO" | grep -c '"AttributeName": "SK"' || echo "0")

if [ "$PK_EXISTS" -gt 0 ] && [ "$SK_EXISTS" -gt 0 ]; then
  echo "✓ Key schema: PK (HASH), SK (RANGE)"
else
  echo "✗ Invalid key schema!"
  exit 1
fi

# Check for required GSIs
EMAIL_INDEX=$(echo "$TABLE_INFO" | grep -c '"IndexName": "EmailIndex"' || echo "0")
CONTACT_EMAIL_INDEX=$(echo "$TABLE_INFO" | grep -c '"IndexName": "ContactEmailIndex"' || echo "0")

if [ "$EMAIL_INDEX" -gt 0 ]; then
  echo "✓ EmailIndex exists"
else
  echo "✗ EmailIndex missing!"
  exit 1
fi

if [ "$CONTACT_EMAIL_INDEX" -gt 0 ]; then
  echo "✓ ContactEmailIndex exists"
else
  echo "✗ ContactEmailIndex missing!"
  exit 1
fi

echo ""
echo "✓ Table is properly configured!"
echo ""
echo "Run './scripts/dynamodb/confirm-indexes.sh' to check index status."
