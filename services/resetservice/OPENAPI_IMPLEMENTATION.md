# OpenAPI Implementation for ResetService

## Overview
This document describes the OpenAPI/Swagger documentation implementation for the ResetService.

## Implementation Details

### 1. Dependencies Added
- `swagger-jsdoc@^6.2.8` - Generates OpenAPI specifications from JSDoc comments

### 2. Files Created/Modified

#### `src/openapi.ts` (NEW)
- Configures OpenAPI 3.0 specification
- Defines service metadata (title, version, description)
- Includes prominent DEV/CI warning in description
- Configures server URL as `/resetservice`
- Defines "Database Reset" tag for endpoint organization

#### `src/routes.ts` (MODIFIED)
- Added JSDoc annotations for `/reset` endpoint
- Documented DELETE method with comprehensive description
- Included WARNING about DEV/CI only usage
- Listed all MongoDB collections that are dropped
- Documented response schemas (200, 500)
- Added component schemas:
  - `ResetResponse` - Success response schema
  - `ErrorResponse` - Error response schema

#### `src/index.ts` (MODIFIED)
- Added import for `swaggerSpec`
- Exposed `/openapi.json` endpoint to serve the generated specification
- Endpoint returns JSON with proper Content-Type header

### 3. OpenAPI Specification Structure

```yaml
openapi: 3.0.0
info:
  title: ResetService API
  version: 1.0.0
  description: Database reset utility service for MicroRealEstate (DEV/CI environments only)
  
servers:
  - url: /resetservice
    description: ResetService (DEV/CI only)

paths:
  /reset:
    delete:
      summary: Reset all databases
      description: |
        **WARNING: DEV/CI ONLY** - Drops all MongoDB collections and clears Redis keys
      tags:
        - Database Reset
      responses:
        200:
          description: Database reset successful
        500:
          description: Internal server error

components:
  schemas:
    ResetResponse:
      type: object
      properties:
        message:
          type: string
          example: success
    ErrorResponse:
      type: object
      properties:
        error:
          type: string
```

### 4. Gateway Integration

The gateway service is already configured to:
- Fetch the OpenAPI spec from `RESETSERVICE_URL/openapi.json`
- Only include ResetService in non-production environments
- Aggregate the spec with other services
- Display it in the unified Swagger UI at `/api-docs`

### 5. Environment Configuration

The following environment variables are already configured:
- `RESETSERVICE_URL=http://resetservice:${RESETSERVICE_PORT}` (in base.env)
- Gateway checks `config.PRODUCTION` to conditionally include ResetService

### 6. Accessing the Documentation

**Individual Service:**
```
GET http://resetservice:8900/openapi.json
```

**Aggregated Documentation (via Gateway):**
```
GET http://gateway:8080/api-docs
```
Note: ResetService endpoints only appear in non-production environments.

## Validation

The implementation has been validated to ensure:
- ✅ OpenAPI spec is generated correctly from JSDoc annotations
- ✅ All required fields are present (openapi, info, paths)
- ✅ DEV/CI warnings are prominently displayed
- ✅ Endpoint documentation includes all response codes
- ✅ Schemas are properly defined
- ✅ Tags are correctly applied
- ✅ TypeScript compilation succeeds without errors

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:
- **Requirement 1.5**: Documentation includes ResetService endpoints
- **Requirement 3.1**: Documentation is automatically generated from code annotations

## Notes

- This service is **DEV/CI ONLY** and should never be deployed to production
- The gateway automatically excludes this service in production environments
- The `/reset` endpoint is destructive and irreversible
- All MongoDB collections and Redis keys are deleted when called
