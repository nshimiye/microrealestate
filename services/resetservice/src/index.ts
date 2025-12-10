import * as Express from 'express';
import { EnvironmentConfig, logger, Service, DynamoDBClient } from '@microrealestate/common';
import routes from './routes.js';
import { swaggerSpec } from './openapi.js';

Main();

async function onStartUp(express: Express.Application) {
  express.use(routes);
  
  // Expose OpenAPI specification
  express.get('/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

async function Main() {
  let service;
  try {
    service = Service.getInstance(
      new EnvironmentConfig({
        PORT: Number(process.env.PORT || 8900)
      })
    );

    await service.init({
      name: 'Reset service',
      useMongo: true,
      useDynamo: true, // TODO use env variable
      useRedis: true,
      onStartUp
    });

    await service.startUp();

  } catch (error) {
    logger.error(String(error));
    service?.shutDown(-1);
  }
}
