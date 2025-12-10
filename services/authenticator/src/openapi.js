import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Authenticator Service API',
    version: '1.0.0',
    description:
      'Authentication service handling login/logout and JWT token management for MicroRealEstate',
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
      url: '/api/v2/authenticator',
      description: 'Authenticator Service'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token obtained from /api/v2/authenticator/landlord/signin'
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'refreshToken',
        description: 'Refresh token stored in HTTP-only cookie'
      }
    }
  }
};

const options = {
  definition: swaggerDefinition,
  apis: [join(__dirname, 'routes', '*.js')]
};

export const swaggerSpec = swaggerJsdoc(options);
