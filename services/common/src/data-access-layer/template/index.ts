import MongoRepository from './mongodb/repository.js';
import DynamoRepository from './dynamodb/repository.js';
import { ITemplateRepository } from './interface.js';
import Service from '../../utils/service.js';

export { ITemplateRepository } from './interface.js';

// Export for testing
export { default as TemplateMongoRepository } from './mongodb/repository.js';


// START
// TEMP: need to update testsetup to init a service so that we can get env variable
//      from the service
const useDynamoDB = String(process.env['USE_DYNAMODB']) === 'true';
let dbType: 'MONGODB'|'DYNAMODB' = 'MONGODB';
if(useDynamoDB) dbType = 'DYNAMODB';
// END



/**
 * Get the singleton TemplateRepository instance
 * @returns TemplateRepository instance
 */
export function getTemplateRepositoryImpl(): ITemplateRepository {
if (dbType === 'DYNAMODB') {
    return new DynamoRepository();
  }
  return new MongoRepository();
}

let templateRepositoryInstance: ITemplateRepository | null = null;
/**
 * Get the singleton RealmRepository instance
 * @returns RealmRepository instance
 */
export function getTemplateRepository(): ITemplateRepository {
  if (!templateRepositoryInstance) {
    templateRepositoryInstance = getTemplateRepositoryImpl();
  }
  return templateRepositoryInstance;
}