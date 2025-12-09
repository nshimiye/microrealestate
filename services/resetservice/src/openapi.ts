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
      url: '/api/v2/resetservice',
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

/**
curl -X 'DELETE' \
  'http://localhost:8080/api/v2/reset' \
  -H 'accept: text/plain' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50Ijp7ImZpcnN0bmFtZSI6IkpvaG4iLCJsYXN0bmFtZSI6IkRvZSIsImVtYWlsIjoiam9obi5kb2VAZXhhbXBsZS5jb20iLCJjcmVhdGVkRGF0ZSI6IjIwMjUtMTItMDZUMDE6MTE6NDEuNTY5WiJ9LCJpYXQiOjE3NjUyNDMxMDMsImV4cCI6MTc2NTI0NjcwM30.LG8zE7Rhk-UI0xasHYqYBlcrr-gGsy4nsX5E99KBK9I'
 


  curl -X 'GET' \
  'http://localhost:8080/api/v2/realms' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50Ijp7ImZpcnN0bmFtZSI6IkpvaG4iLCJsYXN0bmFtZSI6IkRvZSIsImVtYWlsIjoiam9obi5kb2VAZXhhbXBsZS5jb20iLCJjcmVhdGVkRGF0ZSI6IjIwMjUtMTItMDZUMDE6MTE6NDEuNTY5WiJ9LCJpYXQiOjE3NjUyNDMxMDMsImV4cCI6MTc2NTI0NjcwM30.LG8zE7Rhk-UI0xasHYqYBlcrr-gGsy4nsX5E99KBK9I'
 */