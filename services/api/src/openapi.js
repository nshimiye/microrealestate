import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'API Service',
    version: '1.0.0',
    description:
      'Main landlord REST API service for managing properties, tenants, leases, and rental operations in MicroRealEstate',
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
      url: '/api/v2',
      description: 'API Service'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'JWT access token obtained from /api/v2/authenticator/landlord/signin'
      }
    }
  }
};

const options = {
  definition: swaggerDefinition,
  apis: [join(__dirname, 'routes.js')]
};

export const swaggerSpec = swaggerJsdoc(options);
