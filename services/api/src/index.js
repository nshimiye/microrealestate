import { EnvironmentConfig, logger, Service } from '@microrealestate/common';
import { fileURLToPath } from 'url';
import i18n from 'i18n';
import migratedb from '../scripts/migration.js';
import path from 'path';
import { restoreDB } from '../scripts/dbbackup.js';
import routes from './routes.js';
import { swaggerSpec } from './openapi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

i18n.configure({
  locales: ['en', 'fr-FR', 'pt-BR', 'de-DE', 'es-CO'],
  directory: path.join(__dirname, 'locales'),
  updateFiles: false
});

async function onStartUp(application) {
  const { RESTORE_DB } = Service.getInstance().envConfig.getValues();
  if (RESTORE_DB) {
    logger.debug('restoring database from backup');
    await restoreDB();
    logger.debug('database restored');
  }

  // migrate db to the new models
  await migratedb();

  // Expose OpenAPI spec endpoint
    console.log('hi there');
  application.get('/openapi.json', (req, res) => {
    console.log('hi there');
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  application.get('/test', (req, res) => res.send("okok"))
  application.use(routes());
}

async function Main() {
  let service;
  try {
    service = Service.getInstance(
      new EnvironmentConfig({
        DEMO_MODE: process.env.DEMO_MODE
          ? process.env.DEMO_MODE.toLowerCase() === 'true'
          : undefined,
        RESTORE_DB: process.env.RESTORE_DB
          ? process.env.RESTORE_DB.toLowerCase() === 'true'
          : undefined,
        EMAILER_URL: process.env.EMAILER_URL || 'http://localhost:8083/emailer',
        PDFGENERATOR_URL:
          process.env.PDFGENERATOR_URL || 'http://localhost:8082/pdfgenerator'
      })
    );

    await service.init({
      name: 'api',
      useMongo: true,
      useAxios: true,
      onStartUp
    });
    await service.startUp();
  } catch (err) {
    logger.error(err);
    service.shutdown(1);
  }
}

Main();
