import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'ResetService API',
    version: '1.0.0',
    description:
      'Database reset utility service for MicroRealEstate (DEV/CI environments only). This service provides endpoints to reset MongoDB collections and Redis cache for testing and development purposes.',
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
      url: '/resetservice',
      description: 'ResetService (DEV/CI only)'
    }
  ],
  tags: [
    {
      name: 'Database Reset',
      description: 'Operations for resetting databases (DEV/CI only)'
    }
  ]
};

const options = {
  definition: swaggerDefinition,
  apis: [join(__dirname, '../dist/routes.js')]
};

export const swaggerSpec = swaggerJsdoc(options);
