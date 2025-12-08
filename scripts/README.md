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
# Create table for local development (default)
./scripts/dynamodb/create-table.sh

# Create table in AWS with custom name
./scripts/dynamodb/create-table.sh --aws --table-name microrealestate-dev

# Create table in specific AWS region
./scripts/dynamodb/create-table.sh --aws --table-name microrealestate-prod --region us-west-2
```

Creates a DynamoDB table with the required schema (PK/SK keys and GSIs for Email and ContactEmail).

**Default behavior:** Uses local DynamoDB at localhost:8000 with dummy credentials.

**Options:**
- `--aws` - Use AWS DynamoDB instead of local
- `--table-name NAME` - Specify table name (default: microrealestate-local)
- `--region REGION` - AWS region (default: us-east-1)
- `--endpoint URL` - Custom DynamoDB endpoint (default: http://localhost:8000)
- `--help` - Show usage information

### Verify Table Configuration

```bash
# Verify local table (default)
./scripts/dynamodb/confirm-table.sh

# Verify AWS table
./scripts/dynamodb/confirm-table.sh --aws --table-name microrealestate-dev
```

Checks that the DynamoDB table exists and has the correct configuration (key schema, billing mode, GSIs).

**Default behavior:** Checks local DynamoDB at localhost:8000.

### Verify Index Status

```bash
# Check local index status (default)
./scripts/dynamodb/confirm-indexes.sh

# Check AWS table indexes
./scripts/dynamodb/confirm-indexes.sh --aws --table-name microrealestate-dev

# Monitor index creation progress
watch -n 5 ./scripts/dynamodb/confirm-indexes.sh
```

Verifies that all Global Secondary Indexes (EmailIndex, ContactEmailIndex) are in ACTIVE status.

**Default behavior:** Checks local DynamoDB at localhost:8000.

### List Items in Table

```bash
# List 10 items from local table (default)
./scripts/dynamodb/list-items.sh

# List 20 items
./scripts/dynamodb/list-items.sh --limit 20

# List only REALM entities
./scripts/dynamodb/list-items.sh --type REALM

# List accounts in JSON format
./scripts/dynamodb/list-items.sh --type ACCOUNT --json

# List from AWS table
./scripts/dynamodb/list-items.sh --aws --table-name microrealestate-dev
```

Lists items from the DynamoDB table with optional filtering by entity type.

**Default behavior:** Lists 10 items from local DynamoDB in table format.

**Entity types:** REALM, ACCOUNT, LEASE, PROPERTY, TENANT, DOCUMENT, TEMPLATE

## Quick Start for DynamoDB Local Development

1. Start DynamoDB Local container:
   ```bash
   docker-compose up -d dynamodb-local
   ```

2. Create the table (defaults to local):
   ```bash
   ./scripts/dynamodb/create-table.sh
   ```

3. Verify setup (defaults to local):
   ```bash
   ./scripts/dynamodb/confirm-table.sh
   ./scripts/dynamodb/confirm-indexes.sh
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
