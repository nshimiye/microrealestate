#!/bin/bash

# Script to check which database backend is configured (MongoDB or DynamoDB)

set -e

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "Checking database configuration..."
echo ""

# Check USE_DYNAMODB flag
if [ "$USE_DYNAMODB" = "true" ]; then
  echo "Database Backend: DynamoDB"
  echo ""
  echo "Configuration:"
  echo "  Table Name: ${DYNAMODB_TABLE_NAME:-not set}"
  echo "  Region: ${DYNAMODB_REGION:-not set}"
  echo "  Endpoint: ${DYNAMODB_ENDPOINT:-AWS DynamoDB (no local endpoint)}"
  echo ""
  
  if [ -n "$DYNAMODB_ENDPOINT" ]; then
    echo "Mode: Local Development (DynamoDB Local)"
  else
    echo "Mode: AWS DynamoDB"
  fi
  
  echo ""
  echo "Verify table with: ./scripts/dynamodb/confirm-table.sh"
else
  echo "Database Backend: MongoDB"
  echo ""
  echo "Configuration:"
  echo "  Connection URL: ${MONGO_URL:-not set}"
  echo ""
  echo "Verify connection with: ./scripts/check-db-connection.sh"
fi

echo ""
echo "To switch database backends, update USE_DYNAMODB in your .env file:"
echo "  USE_DYNAMODB=true   # Use DynamoDB"
echo "  USE_DYNAMODB=false  # Use MongoDB (or omit the variable)"
