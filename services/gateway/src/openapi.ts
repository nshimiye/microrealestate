import * as Express from 'express';
import { logger, Service } from '@microrealestate/common';
import axios from 'axios';
import swaggerUi from 'swagger-ui-express';

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    contact?: {
      name?: string;
      url?: string;
    };
    license?: {
      name?: string;
      url?: string;
    };
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths?: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
    responses?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

/**
 * Validates the structure of an OpenAPI specification
 */
export function validateSpec(spec: any, serviceName: string): boolean {
  if (!spec || typeof spec !== 'object') {
    logger.error(`Invalid spec from ${serviceName}: not an object`);
    return false;
  }
  if (!spec.openapi || !spec.info || !spec.paths) {
    logger.error(`Invalid spec from ${serviceName}: missing required fields`);
    return false;
  }
  return true;
}

   const getSepcsEndpoint = (endpoint: string) => {
        const url = new URL(endpoint as string);
        // return `${url.origin}/health`;
        return `${url.origin}/openapi.json`;
      };
/**
 * Fetches OpenAPI specification from a service
 */
export async function fetchSpec(
  serviceUrl: string,
  serviceName: string
): Promise<OpenAPISpec | null> {
  try {
    const response = await axios.get(getSepcsEndpoint(serviceUrl), {
      timeout: 5000
    });
    
    if (!validateSpec(response.data, serviceName)) {
      return null;
    }
    
    return {
      ...response.data,
      info: { ...response.data.info, title: serviceName }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to fetch OpenAPI spec from ${serviceName}: ${errorMessage}`);
    return null;
  }
}

/**
 * Aggregates multiple OpenAPI specifications into one
 */
export function aggregateSpecs(specs: Array<OpenAPISpec | null>): OpenAPISpec {
  const validSpecs = specs.filter((spec): spec is OpenAPISpec => spec !== null);

  // Create base specification
  const aggregated: OpenAPISpec = {
    openapi: '3.0.0',
    info: {
      title: 'MicroRealEstate API',
      version: '1.0.0',
      description: `Comprehensive API documentation for all MicroRealEstate services.

## Authentication

Most endpoints require authentication using JWT (JSON Web Token) Bearer tokens.

### How to authenticate:

1. **Obtain an access token**: Send a POST request to \`/api/v2/authenticator/signin\` with your email and password
2. **Use the token**: Include the access token in the Authorization header of your requests:
   \`\`\`
   Authorization: Bearer <your_access_token>
   \`\`\`
3. **Try it out**: Click the "Authorize" button (🔓) at the top of this page to enter your token and test authenticated endpoints

### Token Management:

- Access tokens expire after a period of time
- Use the \`/api/v2/authenticator/refresh\` endpoint to obtain a new access token using your refresh token
- Logout using \`/api/v2/authenticator/logout\` to invalidate your tokens`,
      contact: {
        name: 'MicroRealEstate',
        url: 'https://github.com/microrealestate/microrealestate'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: '/',
        description: 'API Gateway'
      }
    ],
    tags: [],
    paths: {},
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token obtained from /api/v2/authenticator/signin'
        }
      },
      schemas: {},
      responses: {}
    }
  };

  // Merge all specifications
  validSpecs.forEach((spec) => {
    // Get the service's base URL from its servers array
    const serviceBaseUrl = spec.servers?.[0]?.url || '';
    
    // Merge paths with service base URL prepended
    if (spec.paths && aggregated.paths) {
      Object.entries(spec.paths).forEach(([path, pathItem]) => {
        // Construct full path: serviceBaseUrl + path
        const fullPath = `${serviceBaseUrl}${path}`;
        if (aggregated.paths) {
          aggregated.paths[fullPath] = pathItem;
        }
      });
    }

    // Merge schemas
    if (spec.components?.schemas && aggregated.components?.schemas) {
      Object.assign(aggregated.components.schemas, spec.components.schemas);
    }

    // Merge responses
    if (spec.components?.responses && aggregated.components?.responses) {
      Object.assign(aggregated.components.responses, spec.components.responses);
    }

    // Merge tags
    if (spec.tags && aggregated.tags) {
      aggregated.tags.push(...spec.tags);
    }
  });

  return aggregated;
}

/**
 * Sets up Swagger documentation endpoint
 */
export async function setupSwaggerDocs(
  application: Express.Application
): Promise<void> {
  const config = Service.getInstance().envConfig.getValues();

  // Check if API docs should be enabled
  const enableApiDocs = config.ENABLE_API_DOCS !== 'false';

  if (!enableApiDocs) {
    logger.info('API documentation is disabled');
    application.use('/api-docs', (req, res) => {
      res.status(404).send('API documentation is disabled');
    });
    return;
  }

  try {

 

    // Fetch specifications from all services
    const serviceSpecs = await Promise.all([
      config.API_URL ? fetchSpec(config.API_URL, 'API Service') : Promise.resolve(null),
      config.TENANTAPI_URL ? fetchSpec(config.TENANTAPI_URL, 'TenantAPI Service') : Promise.resolve(null),
      config.AUTHENTICATOR_URL ? fetchSpec(config.AUTHENTICATOR_URL, 'Authenticator Service') : Promise.resolve(null),
      config.PDFGENERATOR_URL ? fetchSpec(config.PDFGENERATOR_URL, 'PDFGenerator Service') : Promise.resolve(null),
      config.EMAILER_URL ? fetchSpec((config.EMAILER_URL), 'Emailer Service') : Promise.resolve(null),
      config.RESETSERVICE_URL ? fetchSpec((config.RESETSERVICE_URL), 'Reset Service') : Promise.resolve(null),
    ]);

    // Aggregate specifications
    const aggregatedSpec = aggregateSpecs(serviceSpecs);

    // Serve Swagger UI
    application.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(aggregatedSpec, {
        explorer: true,
        customSiteTitle: 'MicroRealEstate API Documentation',
        customCss: '.swagger-ui .topbar { display: none }'
      })
    );

    logger.info('API documentation available at /api-docs');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to setup API documentation: ${errorMessage}`);
  }
}
