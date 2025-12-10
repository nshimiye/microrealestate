# DynamoDB Setup Guide

This guide provides step-by-step instructions for setting up DynamoDB as the database backend for MicroRealEstate.

## Table of Contents

- [Overview](#overview)
- [Local Development Setup](#local-development-setup)
- [AWS DynamoDB Setup](#aws-dynamodb-setup)
- [Table Creation](#table-creation)
- [AWS Credentials Configuration](#aws-credentials-configuration)
- [Environment Configuration](#environment-configuration)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Overview

MicroRealEstate supports both MongoDB and DynamoDB as database backends. The DynamoDB implementation uses:

- **Single-table design** with composite keys (PK/SK)
- **Global Secondary Indexes (GSIs)** for efficient querying
- **On-demand billing** for automatic scaling
- **AWS SDK v3** for DynamoDB operations

### Key Design Decisions

| Entity   | Partition Key (PK)      | Sort Key (SK)           |
|----------|-------------------------|-------------------------|
| Realm    | REALM#<realmId>         | REALM#<realmId>         |
| Account  | ACCOUNT#<accountId>     | ACCOUNT#<accountId>     |
| Lease    | REALM#<realmId>         | LEASE#<leaseId>         |
| Property | REALM#<realmId>         | PROPERTY#<propertyId>   |
| Tenant   | REALM#<realmId>         | TENANT#<tenantId>       |
| Document | REALM#<realmId>         | DOCUMENT#<documentId>   |
| Template | REALM#<realmId>         | TEMPLATE#<templateId>   |

## Local Development Setup

For local development, you can use DynamoDB Local, which runs as a Docker container.

### Prerequisites

- Docker and Docker Compose installed
- Node.js 20.x
- Yarn 3.3.0

### Step 1: Start DynamoDB Local

Add DynamoDB Local to your `docker-compose.yml`:

```yaml
services:
  dynamodb-local:
    image: amazon/dynamodb-local:latest
    container_name: dynamodb-local
    ports:
      - "8000:8000"
    command: "-jar DynamoDBLocal.jar -sharedDb -inMemory"
    networks:
      - microrealestate
```

Start the container:

```bash
docker-compose up -d dynamodb-local
```

### Step 2: Create the Table

Use the AWS CLI to create the table locally:

```bash
aws dynamodb create-table \
  --table-name microrealestate-local \
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
  --endpoint-url http://localhost:8000 \
  --region us-east-1
```

**Note**: For local development, you don't need real AWS credentials. Use dummy values:

```bash
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local
```

### Step 3: Configure Environment Variables

Create or update your `.env` file:

```bash
# Enable DynamoDB mode
USE_DYNAMODB=true

# DynamoDB Configuration
DYNAMODB_TABLE_NAME=microrealestate-local
DYNAMODB_REGION=us-east-1
DYNAMODB_ENDPOINT=http://localhost:8000

# Dummy credentials for local development
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
```

### Step 4: Verify the Setup

List tables to confirm creation:

```bash
aws dynamodb list-tables \
  --endpoint-url http://localhost:8000 \
  --region us-east-1
```

Describe the table to verify GSIs:

```bash
aws dynamodb describe-table \
  --table-name microrealestate-local \
  --endpoint-url http://localhost:8000 \
  --region us-east-1
```

## AWS DynamoDB Setup

For production or staging environments, use AWS DynamoDB.

### Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured
- IAM user or role with DynamoDB permissions

### Required IAM Permissions

Your IAM user or role needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DescribeTable",
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/microrealestate-*",
        "arn:aws:dynamodb:*:*:table/microrealestate-*/index/*"
      ]
    }
  ]
}
```

## Table Creation

### Using AWS CLI

Create the production table:

```bash
aws dynamodb create-table \
  --table-name microrealestate-production \
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
  --region us-east-1 \
  --tags Key=Application,Value=MicroRealEstate Key=Environment,Value=Production
```

### Using AWS Console

1. Navigate to DynamoDB in AWS Console
2. Click "Create table"
3. Configure table settings:
   - **Table name**: `microrealestate-production`
   - **Partition key**: `PK` (String)
   - **Sort key**: `SK` (String)
4. Under "Table settings", select "Customize settings"
5. Choose "On-demand" for capacity mode
6. Add Global Secondary Indexes:

   **EmailIndex**:
   - Partition key: `Email` (String)
   - Sort key: `EntityType` (String)
   - Projection type: All attributes

   **ContactEmailIndex**:
   - Partition key: `ContactEmail` (String)
   - Sort key: `EntityType` (String)
   - Projection type: All attributes

7. Add tags (optional):
   - `Application`: `MicroRealEstate`
   - `Environment`: `Production`
8. Click "Create table"

### Using CloudFormation

Create a `dynamodb-table.yaml` file:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'DynamoDB table for MicroRealEstate'

Parameters:
  TableName:
    Type: String
    Default: microrealestate-production
    Description: Name of the DynamoDB table
  
  Environment:
    Type: String
    Default: production
    AllowedValues:
      - development
      - staging
      - production
    Description: Environment name

Resources:
  MicroRealEstateTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Ref TableName
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: PK
          AttributeType: S
        - AttributeName: SK
          AttributeType: S
        - AttributeName: Email
          AttributeType: S
        - AttributeName: ContactEmail
          AttributeType: S
        - AttributeName: EntityType
          AttributeType: S
      KeySchema:
        - AttributeName: PK
          KeyType: HASH
        - AttributeName: SK
          KeyType: RANGE
      GlobalSecondaryIndexes:
        - IndexName: EmailIndex
          KeySchema:
            - AttributeName: Email
              KeyType: HASH
            - AttributeName: EntityType
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
        - IndexName: ContactEmailIndex
          KeySchema:
            - AttributeName: ContactEmail
              KeyType: HASH
            - AttributeName: EntityType
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
      Tags:
        - Key: Application
          Value: MicroRealEstate
        - Key: Environment
          Value: !Ref Environment
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true

Outputs:
  TableName:
    Description: Name of the DynamoDB table
    Value: !Ref MicroRealEstateTable
    Export:
      Name: !Sub '${AWS::StackName}-TableName'
  
  TableArn:
    Description: ARN of the DynamoDB table
    Value: !GetAtt MicroRealEstateTable.Arn
    Export:
      Name: !Sub '${AWS::StackName}-TableArn'
```

Deploy the stack:

```bash
aws cloudformation create-stack \
  --stack-name microrealestate-dynamodb \
  --template-body file://dynamodb-table.yaml \
  --parameters ParameterKey=Environment,ParameterValue=production \
  --region us-east-1
```

### Using Terraform

Create a `dynamodb.tf` file:

```hcl
variable "table_name" {
  description = "Name of the DynamoDB table"
  type        = string
  default     = "microrealestate-production"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

resource "aws_dynamodb_table" "microrealestate" {
  name           = var.table_name
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "Email"
    type = "S"
  }

  attribute {
    name = "ContactEmail"
    type = "S"
  }

  attribute {
    name = "EntityType"
    type = "S"
  }

  global_secondary_index {
    name            = "EmailIndex"
    hash_key        = "Email"
    range_key       = "EntityType"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "ContactEmailIndex"
    hash_key        = "ContactEmail"
    range_key       = "EntityType"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Application = "MicroRealEstate"
    Environment = var.environment
  }
}

output "table_name" {
  description = "Name of the DynamoDB table"
  value       = aws_dynamodb_table.microrealestate.name
}

output "table_arn" {
  description = "ARN of the DynamoDB table"
  value       = aws_dynamodb_table.microrealestate.arn
}
```

Apply the configuration:

```bash
terraform init
terraform plan
terraform apply
```

## AWS Credentials Configuration

### Option 1: Environment Variables (Development)

Set credentials directly in your environment:

```bash
export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
export AWS_REGION=us-east-1
```

Or add to your `.env` file:

```bash
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
DYNAMODB_REGION=us-east-1
```

### Option 2: AWS CLI Configuration (Development)

Configure AWS CLI with your credentials:

```bash
aws configure
```

This creates `~/.aws/credentials` and `~/.aws/config` files that the AWS SDK will automatically use.

### Option 3: IAM Roles (Production - Recommended)

For production deployments on AWS (EC2, ECS, Lambda), use IAM roles instead of access keys:

1. Create an IAM role with DynamoDB permissions
2. Attach the role to your compute resource (EC2 instance, ECS task, etc.)
3. The AWS SDK will automatically use the role credentials
4. **Do not** set `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` environment variables

**Benefits**:
- No credentials to manage or rotate
- Automatic credential rotation
- Better security posture
- Follows AWS best practices

### Option 4: AWS Secrets Manager (Production)

Store credentials in AWS Secrets Manager and retrieve them at runtime:

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function getCredentials() {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: 'microrealestate/dynamodb' })
  );
  return JSON.parse(response.SecretString);
}
```

## Environment Configuration

### Complete Environment Variables

```bash
# ============================================
# DynamoDB Configuration
# ============================================

# Enable DynamoDB mode (set to 'true' to use DynamoDB, omit or set to 'false' for MongoDB)
USE_DYNAMODB=true

# DynamoDB table name
DYNAMODB_TABLE_NAME=microrealestate-production

# AWS region where the table is located
DYNAMODB_REGION=us-east-1

# Optional: DynamoDB endpoint (only for local development)
# Comment out or remove for AWS DynamoDB
# DYNAMODB_ENDPOINT=http://localhost:8000

# ============================================
# AWS Credentials (if not using IAM roles)
# ============================================

# AWS access key ID
# AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE

# AWS secret access key
# AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# ============================================
# MongoDB Configuration (fallback)
# ============================================

# MongoDB connection URL (used when USE_DYNAMODB is false)
MONGO_URL=mongodb://localhost:27017/microrealestate
```

### Environment-Specific Configuration

**Development** (`.env.development`):
```bash
USE_DYNAMODB=true
DYNAMODB_TABLE_NAME=microrealestate-dev
DYNAMODB_REGION=us-east-1
DYNAMODB_ENDPOINT=http://localhost:8000
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
```

**Staging** (`.env.staging`):
```bash
USE_DYNAMODB=true
DYNAMODB_TABLE_NAME=microrealestate-staging
DYNAMODB_REGION=us-east-1
# Use IAM role or AWS CLI credentials
```

**Production** (`.env.production`):
```bash
USE_DYNAMODB=true
DYNAMODB_TABLE_NAME=microrealestate-production
DYNAMODB_REGION=us-east-1
# Use IAM role - no credentials needed
```

## Verification

### Verify Table Creation

Check that the table exists:

```bash
aws dynamodb describe-table \
  --table-name microrealestate-production \
  --region us-east-1
```

Expected output should include:
- Table status: `ACTIVE`
- Two Global Secondary Indexes: `EmailIndex` and `ContactEmailIndex`
- Billing mode: `PAY_PER_REQUEST`

### Verify GSI Status

Check that GSIs are active:

```bash
aws dynamodb describe-table \
  --table-name microrealestate-production \
  --region us-east-1 \
  --query 'Table.GlobalSecondaryIndexes[*].[IndexName,IndexStatus]' \
  --output table
```

Both indexes should show status `ACTIVE`.

### Test Application Connection

Start your application and check the logs:

```bash
yarn dev
```

Look for log messages indicating successful DynamoDB connection:
```
[INFO] DynamoDB client initialized
[INFO] Using table: microrealestate-production
[INFO] Region: us-east-1
```

### Test Basic Operations

Use the application to create a test account or realm. Check DynamoDB to verify the item was created:

```bash
aws dynamodb scan \
  --table-name microrealestate-production \
  --limit 10 \
  --region us-east-1
```

## Troubleshooting

### Issue: "Cannot do operations on a non-existent table"

**Cause**: The table doesn't exist or the table name is incorrect.

**Solution**:
1. Verify the table name in your environment variables matches the actual table name
2. Check that the table exists:
   ```bash
   aws dynamodb list-tables --region us-east-1
   ```
3. Create the table if it doesn't exist (see [Table Creation](#table-creation))

### Issue: "User is not authorized to perform: dynamodb:PutItem"

**Cause**: IAM permissions are insufficient.

**Solution**:
1. Verify your IAM user/role has the required permissions (see [Required IAM Permissions](#required-iam-permissions))
2. Check that the resource ARN in the policy matches your table name
3. For local development, ensure you're using the `--endpoint-url` flag

### Issue: "The security token included in the request is invalid"

**Cause**: AWS credentials are invalid, expired, or not configured.

**Solution**:
1. For local development with DynamoDB Local, use dummy credentials:
   ```bash
   export AWS_ACCESS_KEY_ID=local
   export AWS_SECRET_ACCESS_KEY=local
   ```
2. For AWS DynamoDB, verify your credentials:
   ```bash
   aws sts get-caller-identity
   ```
3. Reconfigure AWS CLI if needed:
   ```bash
   aws configure
   ```

### Issue: "ResourceNotFoundException: Requested resource not found: Table: microrealestate-production not found"

**Cause**: The table doesn't exist in the specified region.

**Solution**:
1. Verify the region in your environment variables:
   ```bash
   echo $DYNAMODB_REGION
   ```
2. List tables in the region:
   ```bash
   aws dynamodb list-tables --region us-east-1
   ```
3. Create the table in the correct region

### Issue: "ValidationException: One or more parameter values were invalid: An AttributeValue may not contain an empty string"

**Cause**: Attempting to store an empty string in DynamoDB.

**Solution**:
1. DynamoDB does not support empty strings as attribute values
2. Validate input data to ensure no empty strings are present
3. See [DYNAMODB_CONSTRAINTS.md](./DYNAMODB_CONSTRAINTS.md) for details on empty string handling
4. Consider implementing empty string sanitization (currently deferred)

### Issue: "ProvisionedThroughputExceededException: The level of configured provisioned throughput for the table was exceeded"

**Cause**: Too many requests to the table (only occurs with provisioned billing mode).

**Solution**:
1. The default configuration uses on-demand billing, which auto-scales
2. If you changed to provisioned mode, increase the provisioned capacity
3. Implement exponential backoff in your application (AWS SDK does this automatically)
4. Consider switching back to on-demand billing:
   ```bash
   aws dynamodb update-table \
     --table-name microrealestate-production \
     --billing-mode PAY_PER_REQUEST \
     --region us-east-1
   ```

### Issue: "Cannot connect to DynamoDB Local at localhost:8000"

**Cause**: DynamoDB Local container is not running.

**Solution**:
1. Check if the container is running:
   ```bash
   docker ps | grep dynamodb
   ```
2. Start the container:
   ```bash
   docker-compose up -d dynamodb-local
   ```
3. Verify the port mapping:
   ```bash
   docker port dynamodb-local
   ```
4. Check container logs:
   ```bash
   docker logs dynamodb-local
   ```

### Issue: "Index EmailIndex is not active"

**Cause**: GSI is still being created or has failed.

**Solution**:
1. Check the index status:
   ```bash
   aws dynamodb describe-table \
     --table-name microrealestate-production \
     --region us-east-1 \
     --query 'Table.GlobalSecondaryIndexes[*].[IndexName,IndexStatus]'
   ```
2. Wait for the index to become `ACTIVE` (can take several minutes)
3. If status is `FAILED`, delete and recreate the index:
   ```bash
   aws dynamodb update-table \
     --table-name microrealestate-production \
     --global-secondary-index-updates \
       '[{"Delete":{"IndexName":"EmailIndex"}}]' \
     --region us-east-1
   ```
   Then recreate it using the create-table command

### Issue: "Item size exceeds 400KB limit"

**Cause**: DynamoDB has a 400KB limit per item.

**Solution**:
1. The application validates item size before writing
2. Check application logs for details about which entity exceeded the limit
3. Consider:
   - Storing large data (documents, images) in S3 and keeping only references in DynamoDB
   - Splitting large entities into multiple items
   - Compressing data before storage
4. See [DYNAMODB_CONSTRAINTS.md](./DYNAMODB_CONSTRAINTS.md) for more details

### Issue: Application still using MongoDB despite USE_DYNAMODB=true

**Cause**: Environment variable not loaded or cached.

**Solution**:
1. Verify the environment variable is set:
   ```bash
   echo $USE_DYNAMODB
   ```
2. Restart the application to reload environment variables
3. Check that `.env` file is in the correct location (project root)
4. Verify the application is reading from the correct `.env` file
5. Check application logs for database initialization messages

### Issue: "ConditionalCheckFailedException: The conditional request failed"

**Cause**: Attempting to update an item that doesn't exist or doesn't meet the condition.

**Solution**:
1. This is expected behavior for conditional updates
2. The application should handle this error and return appropriate HTTP status (404 or 409)
3. Verify the item exists before attempting conditional updates
4. Check application logs for details about which condition failed

### Debugging Tips

1. **Enable Debug Logging**: Set log level to debug to see DynamoDB operations:
   ```bash
   LOG_LEVEL=debug yarn dev
   ```

2. **Use AWS CLI to Inspect Data**: Query the table directly to verify data:
   ```bash
   aws dynamodb get-item \
     --table-name microrealestate-production \
     --key '{"PK":{"S":"ACCOUNT#123"},"SK":{"S":"ACCOUNT#123"}}' \
     --region us-east-1
   ```

3. **Check CloudWatch Metrics**: Monitor DynamoDB metrics in AWS CloudWatch:
   - Read/Write capacity units
   - Throttled requests
   - System errors

4. **Use DynamoDB Streams**: Enable streams to debug data changes:
   ```bash
   aws dynamodb update-table \
     --table-name microrealestate-production \
     --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
     --region us-east-1
   ```

5. **Test with AWS CLI**: Verify operations work directly with AWS CLI before debugging application code

## Additional Resources

- [AWS DynamoDB Documentation](https://docs.aws.amazon.com/dynamodb/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [DynamoDB Local Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html)
- [MicroRealEstate DynamoDB Constraints](./DYNAMODB_CONSTRAINTS.md)
- [MicroRealEstate Common Package README](./README.md)

## Support

For issues specific to MicroRealEstate's DynamoDB implementation:
1. Check the [Troubleshooting](#troubleshooting) section above
2. Review [DYNAMODB_CONSTRAINTS.md](./DYNAMODB_CONSTRAINTS.md) for constraint-related issues
3. Check application logs for detailed error messages
4. Open an issue on the MicroRealEstate GitHub repository

For AWS DynamoDB issues:
1. Check [AWS Service Health Dashboard](https://status.aws.amazon.com/)
2. Review [AWS DynamoDB Troubleshooting Guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Programming.Errors.html)
3. Contact AWS Support if you have a support plan
