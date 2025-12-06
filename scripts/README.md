# Development Scripts

This directory contains utility scripts for managing MicroRealEstate during development.

## Database Scripts

### Check Database Configuration

```bash
./scripts/check-used-db.sh
```

Shows which database backend is currently configured (MongoDB or DynamoDB) and displays the relevant configuration settings.

### Check Database Connection

```bash
./scripts/check-db-connection.sh
```

Tests the connection to the configured database (MongoDB or DynamoDB) and verifies that the database/table is accessible.

## DynamoDB Scripts

These scripts help manage DynamoDB tables for local development and AWS deployments.

### Create DynamoDB Table

```bash
# Create table for local development
./scripts/dynamodb/create-table.sh --local

# Create table in AWS with custom name
./scripts/dynamodb/create-table.sh --table-name microrealestate-dev

# Create table in specific region
./scripts/dynamodb/create-table.sh --table-name microrealestate-prod --region us-west-2

# Use environment variables from .env
./scripts/dynamodb/create-table.sh
```

Creates a DynamoDB table with the required schema (PK/SK keys and GSIs for Email and ContactEmail).

**Options:**
- `--local` - Use local DynamoDB at localhost:8000
- `--table-name NAME` - Specify table name (default: from DYNAMODB_TABLE_NAME env var)
- `--region REGION` - AWS region (default: from DYNAMODB_REGION env var)
- `--endpoint URL` - Custom DynamoDB endpoint
- `--help` - Show usage information

### Verify Table Configuration

```bash
# Verify table using .env configuration
./scripts/dynamodb/confirm-table.sh

# Verify local table
./scripts/dynamodb/confirm-table.sh --local

# Verify specific table
./scripts/dynamodb/confirm-table.sh --table-name microrealestate-dev
```

Checks that the DynamoDB table exists and has the correct configuration (key schema, billing mode, GSIs).

### Verify Index Status

```bash
# Check index status using .env configuration
./scripts/dynamodb/confirm-indexes.sh

# Check local table indexes
./scripts/dynamodb/confirm-indexes.sh --local

# Monitor index creation progress
watch -n 5 ./scripts/dynamodb/confirm-indexes.sh
```

Verifies that all Global Secondary Indexes (EmailIndex, ContactEmailIndex) are in ACTIVE status.

## Quick Start for DynamoDB Local Development

1. Start DynamoDB Local container:
   ```bash
   docker-compose up -d dynamodb-local
   ```

2. Create the table:
   ```bash
   ./scripts/dynamodb/create-table.sh --local
   ```

3. Verify setup:
   ```bash
   ./scripts/dynamodb/confirm-table.sh --local
   ./scripts/dynamodb/confirm-indexes.sh --local
   ```

4. Update your `.env` file:
   ```bash
   USE_DYNAMODB=true
   DYNAMODB_TABLE_NAME=microrealestate-local
   DYNAMODB_REGION=us-east-1
   DYNAMODB_ENDPOINT=http://localhost:8000
   AWS_ACCESS_KEY_ID=local
   AWS_SECRET_ACCESS_KEY=local
   ```

5. Check configuration:
   ```bash
   ./scripts/check-used-db.sh
   ./scripts/check-db-connection.sh
   ```

## Prerequisites

- **AWS CLI** - Required for DynamoDB scripts
  ```bash
  # macOS
  brew install awscli
  
  # Or use pip
  pip install awscli
  ```

- **Docker** - Required for local DynamoDB
- **MongoDB client** (optional) - For MongoDB connection testing
  ```bash
  # macOS
  brew install mongosh
  ```

## Environment Variables

The scripts read configuration from your `.env` file:

**DynamoDB:**
- `USE_DYNAMODB` - Set to `true` to use DynamoDB
- `DYNAMODB_TABLE_NAME` - Table name
- `DYNAMODB_REGION` - AWS region
- `DYNAMODB_ENDPOINT` - Local endpoint (e.g., http://localhost:8000)
- `AWS_ACCESS_KEY_ID` - AWS credentials (use "local" for local dev)
- `AWS_SECRET_ACCESS_KEY` - AWS credentials (use "local" for local dev)

**MongoDB:**
- `MONGO_URL` - MongoDB connection string

## Troubleshooting

### DynamoDB Local not responding

```bash
# Check if container is running
docker ps | grep dynamodb

# View container logs
docker logs dynamodb-local

# Restart container
docker-compose restart dynamodb-local
```

### AWS credentials error

For local development, use dummy credentials:
```bash
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local
```

For AWS DynamoDB, configure credentials:
```bash
aws configure
```

### Table already exists

If you need to recreate the table:
```bash
# Delete the table
aws dynamodb delete-table --table-name microrealestate-local --endpoint-url http://localhost:8000 --region us-east-1

# Wait a moment, then recreate
./scripts/dynamodb/create-table.sh --local
```

## See Also

- [DynamoDB Setup Guide](../services/common/DYNAMODB_SETUP.md) - Complete setup documentation
- [DynamoDB Constraints](../services/common/DYNAMODB_CONSTRAINTS.md) - Implementation constraints
