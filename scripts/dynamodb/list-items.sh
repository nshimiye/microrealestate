#!/bin/bash

# Script to list items in DynamoDB table with filtering options

set -e

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Default values (local development mode)
TABLE_NAME="${DYNAMODB_TABLE_NAME:-microrealestate-local}"
REGION="${DYNAMODB_REGION:-us-east-1}"
ENDPOINT="${DYNAMODB_ENDPOINT:-http://localhost:8000}"
LIMIT=10
ENTITY_TYPE=""
OUTPUT_FORMAT="table"

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
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    --type)
      ENTITY_TYPE="$2"
      shift 2
      ;;
    --json)
      OUTPUT_FORMAT="json"
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --table-name NAME    Table name (default: microrealestate-local)"
      echo "  --region REGION      AWS region (default: us-east-1)"
      echo "  --endpoint URL       DynamoDB endpoint (default: http://localhost:8000)"
      echo "  --aws                Use AWS DynamoDB instead of local"
      echo "  --limit N            Number of items to return (default: 10)"
      echo "  --type TYPE          Filter by entity type (REALM, ACCOUNT, LEASE, PROPERTY, TENANT, DOCUMENT, TEMPLATE)"
      echo "  --json               Output in JSON format instead of table"
      echo "  --help               Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                                    # List 10 items from local table"
      echo "  $0 --limit 20                         # List 20 items"
      echo "  $0 --type REALM                       # List only REALM entities"
      echo "  $0 --type ACCOUNT --json              # List accounts in JSON format"
      echo "  $0 --aws --table-name microrealestate-dev  # List from AWS table"
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

echo "Listing items from DynamoDB table..."
echo "  Table name: $TABLE_NAME"
echo "  Region: $REGION"
if [ -n "$ENDPOINT" ]; then
  echo "  Endpoint: $ENDPOINT"
fi
echo "  Limit: $LIMIT"
if [ -n "$ENTITY_TYPE" ]; then
  echo "  Filter: EntityType = $ENTITY_TYPE"
fi
echo ""

# Build the scan command
if [ -n "$ENTITY_TYPE" ]; then
  # Scan with filter
  RESULT=$(aws dynamodb scan \
    --table-name "$TABLE_NAME" \
    --region "$REGION" \
    $ENDPOINT_ARG \
    --limit "$LIMIT" \
    --filter-expression "EntityType = :type" \
    --expression-attribute-values "{\":type\":{\"S\":\"$ENTITY_TYPE\"}}" \
    --output "$OUTPUT_FORMAT")
else
  # Scan without filter
  RESULT=$(aws dynamodb scan \
    --table-name "$TABLE_NAME" \
    --region "$REGION" \
    $ENDPOINT_ARG \
    --limit "$LIMIT" \
    --output "$OUTPUT_FORMAT")
fi

if [ "$OUTPUT_FORMAT" = "json" ]; then
  echo "$RESULT"
else
  echo "$RESULT"
  echo ""
  
  # Get count
  COUNT=$(aws dynamodb scan \
    --table-name "$TABLE_NAME" \
    --region "$REGION" \
    $ENDPOINT_ARG \
    --select COUNT \
    --output text 2>/dev/null | awk '{print $1}')
  
  echo "Total items in table: $COUNT"
  echo ""
  echo "Tip: Use --limit to see more items, --type to filter by entity type, or --json for JSON output"
fi
