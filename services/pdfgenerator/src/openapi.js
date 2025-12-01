import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import swaggerJsdoc from 'swagger-jsdoc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'PDFGenerator Service API',
    version: '1.0.0',
    description:
      'PDF document generation service for creating and managing documents and templates in MicroRealEstate',
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
      url: '/pdfgenerator',
      description: 'PDFGenerator Service'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'JWT access token obtained from /api/v2/authenticator/signin'
      }
    }
  }
};

const options = {
  definition: swaggerDefinition,
  apis: [join(__dirname, 'routes', '*.js')]
};

export const swaggerSpec = swaggerJsdoc(options);
