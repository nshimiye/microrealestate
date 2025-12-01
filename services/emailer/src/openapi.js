import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Emailer Service API',
    version: '1.0.0',
    description:
      'Email generation and sending service for MicroRealEstate. Handles template-based email generation and delivery via Gmail, Mailgun, or SMTP.',
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
      url: '/emailer',
      description: 'Emailer Service'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token obtained from /api/v2/authenticator/landlord/signin'
      }
    }
  }
};

const options = {
  definition: swaggerDefinition,
  apis: [join(__dirname, 'routes.js')]
};

export const swaggerSpec = swaggerJsdoc(options);
