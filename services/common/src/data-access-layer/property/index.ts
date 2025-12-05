import MongoRepository from './mongodb/repository.js';
import DynamoRepository from './dynamodb/repository.js';
import { IPropertyRepository } from './interface.js';
// import Service from '../../utils/service.js';

export { IPropertyRepository } from './interface.js';

// Export for testing
export { default as PropertyMongoRepository } from './mongodb/repository.js';


// START
// TEMP: need to update testsetup to init a service so that we can get env variable
//      from the service
const useDynamoDB = String(process.env['USE_DYNAMODB']) === 'true';
let dbType: 'MONGODB'|'DYNAMODB' = 'MONGODB';
if(useDynamoDB) dbType = 'DYNAMODB';
// END



/**
 * Get the singleton PropertyRepository instance
 * @returns PropertyRepository instance
 */
export function getPropertyRepositoryImpl(): IPropertyRepository {
if (dbType === 'DYNAMODB') {
    return new DynamoRepository();
  }
  return new MongoRepository();
}

let propertyRepositoryInstance: IPropertyRepository | null = null;

/**
 * Get the singleton LeaseRepository instance
 * @returns LeaseRepository instance
 */
export function getPropertyRepository(): IPropertyRepository {
  if (!propertyRepositoryInstance) {
    propertyRepositoryInstance = getPropertyRepositoryImpl();
  }
  return propertyRepositoryInstance;
}
