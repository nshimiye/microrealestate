import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'TenantAPI Service API',
    version: '1.0.0',
    description:
      'Tenant-facing REST API service for MicroRealEstate - allows tenants to view their rental information, invoices, and make payments',
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
      url: '/tenantapi',
      description: 'TenantAPI Service'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'JWT access token obtained from /api/v2/authenticator/tenant/signin'
      }
    }
  }
};

const options = {
  definition: swaggerDefinition,
  apis: [join(__dirname, 'routes.js')]
};

export const swaggerSpec = swaggerJsdoc(options);
