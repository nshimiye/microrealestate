#!/bin/bash

# Script to create DynamoDB table for MicroRealEstate
# Supports both local DynamoDB and AWS DynamoDB

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
      echo ""
      echo "Examples:"
      echo "  $0                                            # Create table in local DynamoDB (default)"
      echo "  $0 --aws --table-name microrealestate-dev     # Create dev table in AWS"
      echo "  $0 --aws --table-name microrealestate-prod --region us-west-2  # Create prod table"
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

echo "Creating DynamoDB table..."
echo "  Table name: $TABLE_NAME"
echo "  Region: $REGION"
if [ -n "$ENDPOINT" ]; then
  echo "  Endpoint: $ENDPOINT"
fi
echo ""

# Create the table
aws dynamodb create-table \
  --table-name "$TABLE_NAME" \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=Email,AttributeType=S \
    AttributeName=ContactEmail,AttributeType=S \
    AttributeName=EntityType,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    "[
      {
        \"IndexName\": \"EmailIndex\",
        \"KeySchema\": [
          {\"AttributeName\":\"Email\",\"KeyType\":\"HASH\"},
          {\"AttributeName\":\"EntityType\",\"KeyType\":\"RANGE\"}
        ],
        \"Projection\": {\"ProjectionType\":\"ALL\"}
      },
      {
        \"IndexName\": \"ContactEmailIndex\",
        \"KeySchema\": [
          {\"AttributeName\":\"ContactEmail\",\"KeyType\":\"HASH\"},
          {\"AttributeName\":\"EntityType\",\"KeyType\":\"RANGE\"}
        ],
        \"Projection\": {\"ProjectionType\":\"ALL\"}
      }
    ]" \
  --region "$REGION" \
  $ENDPOINT_ARG

echo ""
echo "✓ Table created successfully!"
echo ""
echo "Waiting for table to become active..."

# Wait for table to be active
aws dynamodb wait table-exists \
  --table-name "$TABLE_NAME" \
  --region "$REGION" \
  $ENDPOINT_ARG

echo "✓ Table is now active!"
echo ""
echo "Run './scripts/dynamodb/confirm-table.sh' to verify the table configuration.