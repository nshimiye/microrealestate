#!/bin/bash

# Script to check database connection (MongoDB or DynamoDB)

set -e

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "Checking database connection..."
echo ""

# Check which database is configured
if [ "$USE_DYNAMODB" = "true" ]; then
  echo "Testing DynamoDB connection..."
  echo ""
  
  TABLE_NAME="${DYNAMODB_TABLE_NAME:-microrealestate-local}"
  REGION="${DYNAMODB_REGION:-us-east-1}"
  ENDPOINT="${DYNAMODB_ENDPOINT:-}"
  
  # Build endpoint argument
  ENDPOINT_ARG=""
  if [ -n "$ENDPOINT" ]; then
    ENDPOINT_ARG="--endpoint-url $ENDPOINT"
    echo "  Endpoint: $ENDPOINT"
  else
    echo "  Using AWS DynamoDB"
  fi
  
  echo "  Table: $TABLE_NAME"
  echo "  Region: $REGION"
  echo ""
  
  # For local DynamoDB, set dummy credentials if not set
  if [ -n "$ENDPOINT" ] && [ -z "$AWS_ACCESS_KEY_ID" ]; then
    export AWS_ACCESS_KEY_ID=local
    export AWS_SECRET_ACCESS_KEY=local
  fi
  
  # Try to list tables
  if aws dynamodb list-tables \
    --region "$REGION" \
    $ENDPOINT_ARG \
    > /dev/null 2>&1; then
    echo "✓ Successfully connected to DynamoDB"
    
    # Check if our table exists
    if aws dynamodb describe-table \
      --table-name "$TABLE_NAME" \
      --region "$REGION" \
      $ENDPOINT_ARG \
      > /dev/null 2>&1; then
      
      # Get item count
      ITEM_COUNT=$(aws dynamodb describe-table \
        --table-name "$TABLE_NAME" \
        --region "$REGION" \
        $ENDPOINT_ARG \
        --query 'Table.ItemCount' \
        --output text)
      
      echo "✓ Table '$TABLE_NAME' exists"
      echo "✓ Item count: $ITEM_COUNT"
    else
      echo "✗ Table '$TABLE_NAME' does not exist"
      echo ""
      echo "Create it with: ./scripts/dynamodb/create-table.sh"
      exit 1
    fi
  else
    echo "✗ Failed to connect to DynamoDB"
    echo ""
    echo "Troubleshooting:"
    if [ -n "$ENDPOINT" ]; then
      echo "  1. Check if DynamoDB Local is running:"
      echo "     docker ps | grep dynamodb"
      echo "  2. Start DynamoDB Local:"
      echo "     docker-compose up -d dynamodb-local"
    else
      echo "  1. Check AWS credentials:"
      echo "     aws sts get-caller-identity"
      echo "  2. Verify region is correct: $REGION"
      echo "  3. Check IAM permissions for DynamoDB access"
    fi
    exit 1
  fi
  
else
  echo "Testing MongoDB connection..."
  echo ""
  
  MONGO_URL="${MONGO_URL:-mongodb://localhost:27017/microrealestate}"
  echo "  Connection URL: $MONGO_URL"
  echo ""
  
  # Extract host and port from MongoDB URL
  MONGO_HOST=$(echo "$MONGO_URL" | sed -E 's|mongodb://([^:/]+).*|\1|')
  MONGO_PORT=$(echo "$MONGO_URL" | sed -E 's|mongodb://[^:]+:([0-9]+).*|\1|')
  
  # If port extraction failed, use default
  if [ "$MONGO_PORT" = "$MONGO_URL" ]; then
    MONGO_PORT=27017
  fi
  
  # Try to connect using mongosh or mongo
  if command -v mongosh &> /dev/null; then
    MONGO_CMD="mongosh"
  elif command -v mongo &> /dev/null; then
    MONGO_CMD="mongo"
  else
    echo "✗ MongoDB client not found (mongosh or mongo)"
    echo ""
    echo "Trying basic connectivity test..."
    
    # Try basic TCP connection
    if timeout 5 bash -c "cat < /dev/null > /dev/tcp/$MONGO_HOST/$MONGO_PORT" 2>/dev/null; then
      echo "✓ MongoDB port is reachable at $MONGO_HOST:$MONGO_PORT"
      echo ""
      echo "Note: Install mongosh to verify full database connectivity:"
      echo "  https://www.mongodb.com/docs/mongodb-shell/install/"
      exit 0
    else
      echo "✗ Cannot connect to MongoDB at $MONGO_HOST:$MONGO_PORT"
      echo ""
      echo "Troubleshooting:"
      echo "  1. Check if MongoDB is running:"
      echo "     docker ps | grep mongo"
      echo "  2. Start MongoDB:"
      echo "     docker-compose up -d mongo"
      exit 1
    fi
  fi
  
  # Try to connect with MongoDB client
  if $MONGO_CMD "$MONGO_URL" --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
    echo "✓ Successfully connected to MongoDB"
    
    # Get database name from URL
    DB_NAME=$(echo "$MONGO_URL" | sed -E 's|.*/([^?]+).*|\1|')
    
    # Get collection count
    COLLECTION_COUNT=$($MONGO_CMD "$MONGO_URL" --eval "db.getCollectionNames().length" --quiet 2>/dev/null || echo "unknown")
    
    echo "✓ Database: $DB_NAME"
    echo "✓ Collections: $COLLECTION_COUNT"
  else
    echo "✗ Failed to connect to MongoDB"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if MongoDB is running:"
    echo "     docker ps | grep mongo"
    echo "  2. Start MongoDB:"
    echo "     docker-compose up -d mongo"
    echo "  3. Verify connection URL: $MONGO_URL"
    exit 1
  fi
fi

echo ""
echo "✓ Database connection successful!"
