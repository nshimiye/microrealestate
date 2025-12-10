# Requirements Document

## Introduction

This specification addresses the migration of the pdfgenerator service from AWS SDK for JavaScript v2 to v3. The AWS SDK v2 entered maintenance mode on September 8, 2024, and will reach end-of-support on September 8, 2025. This migration is necessary to ensure continued security updates, bug fixes, and compatibility with modern AWS services.

The pdfgenerator service currently uses AWS SDK v2 for S3 operations (file upload, download, and deletion) to support document storage in Backblaze B2 (S3-compatible storage). The migration will update the S3 client implementation while maintaining backward compatibility with existing functionality.

## Glossary

- **AWS SDK**: Amazon Web Services Software Development Kit - a collection of libraries for interacting with AWS services
- **S3**: Simple Storage Service - AWS object storage service (also used by S3-compatible services like Backblaze B2)
- **Backblaze B2**: S3-compatible cloud storage service used by MicroRealEstate for document storage
- **pdfgenerator**: MicroRealEstate microservice responsible for generating and managing PDF documents
- **Credentials**: Authentication information (access key ID and secret access key) for accessing S3 services
- **Endpoint**: URL pointing to the S3 service (custom endpoint for B2, default for AWS S3)
- **Bucket**: Container for storing objects in S3
- **Object**: File stored in S3, identified by a key (path)
- **VersionId**: Unique identifier for a specific version of an S3 object

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want the pdfgenerator service to use AWS SDK v3, so that the service continues to receive security updates and remains compatible with modern AWS services.

#### Acceptance Criteria

1. WHEN the pdfgenerator service starts THEN the system SHALL use AWS SDK v3 packages instead of AWS SDK v2
2. WHEN the application logs are reviewed THEN the system SHALL NOT display AWS SDK v2 deprecation warnings
3. WHEN dependencies are audited THEN the system SHALL NOT include the `aws-sdk` v2 package in the pdfgenerator service

### Requirement 2

**User Story:** As a developer, I want the S3 client initialization to use AWS SDK v3 patterns, so that the code follows modern best practices and is maintainable.

#### Acceptance Criteria

1. WHEN the S3 client is initialized with B2 configuration THEN the system SHALL create an S3Client instance using `@aws-sdk/client-s3` package
2. WHEN credentials are provided THEN the system SHALL configure the client using the credentials object format from AWS SDK v3
3. WHEN a custom endpoint is specified THEN the system SHALL configure the client with the endpoint URL
4. WHEN the S3 client is created THEN the system SHALL use the same encrypted credentials decryption process as the current implementation

### Requirement 3

**User Story:** As a user uploading documents, I want file uploads to continue working seamlessly, so that I can store documents without interruption.

#### Acceptance Criteria

1. WHEN a file is uploaded via the POST /documents endpoint THEN the system SHALL successfully upload the file to S3 using AWS SDK v3
2. WHEN an upload completes THEN the system SHALL return the same response structure containing the document URL and version ID
3. WHEN an upload fails THEN the system SHALL handle errors gracefully and return appropriate error messages
4. WHEN multiple files are uploaded sequentially THEN the system SHALL process each upload independently without interference

### Requirement 4

**User Story:** As a user downloading documents, I want file downloads to continue working seamlessly, so that I can retrieve stored documents without interruption.

#### Acceptance Criteria

1. WHEN a file is requested via the GET /documents/:id endpoint THEN the system SHALL successfully retrieve the file from S3 using AWS SDK v3
2. WHEN a download completes THEN the system SHALL stream the file content to the response with the correct content type
3. WHEN a download fails due to missing file THEN the system SHALL return a 404 error
4. WHEN a download fails due to S3 errors THEN the system SHALL handle errors gracefully and return appropriate error messages

### Requirement 5

**User Story:** As a user deleting documents, I want file deletions to continue working seamlessly, so that I can remove unwanted documents from storage.

#### Acceptance Criteria

1. WHEN documents are deleted via the DELETE /documents endpoint THEN the system SHALL successfully delete the files from S3 using AWS SDK v3
2. WHEN multiple files are deleted in a batch THEN the system SHALL use the batch delete operation to remove all files efficiently
3. WHEN a deletion completes THEN the system SHALL remove the document records from the database
4. WHEN a deletion fails THEN the system SHALL log the error without blocking the database cleanup operation

### Requirement 6

**User Story:** As a developer, I want comprehensive unit tests for S3 operations, so that I can verify the migration works correctly and prevent regressions.

#### Acceptance Criteria

1. WHEN the S3 utility module is tested THEN the system SHALL include unit tests for client initialization
2. WHEN the S3 utility module is tested THEN the system SHALL include unit tests for file upload operations
3. WHEN the S3 utility module is tested THEN the system SHALL include unit tests for file download operations
4. WHEN the S3 utility module is tested THEN the system SHALL include unit tests for file deletion operations
5. WHEN the S3 utility module is tested THEN the system SHALL mock AWS SDK v3 clients to avoid actual S3 calls during testing

### Requirement 7

**User Story:** As a developer, I want the migration to maintain backward compatibility, so that existing integrations and configurations continue to work without changes.

#### Acceptance Criteria

1. WHEN the B2 configuration is provided in the existing format THEN the system SHALL successfully initialize the S3 client
2. WHEN document URLs are stored in the database THEN the system SHALL continue to use the same URL format
3. WHEN version IDs are stored in the database THEN the system SHALL continue to use the same version ID format
4. WHEN the service is deployed THEN the system SHALL require no changes to environment variables or configuration files
