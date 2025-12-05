import MongoRepository from './mongodb/repository.js';
import DynamoRepository from './dynamodb/repository.js';
import { IAccountRepository } from './interface.js';
// import Service from '../../utils/service.js';

export { IAccountRepository } from './interface.js';

// Export for testing
export { default as AccountMongoRepository } from './mongodb/repository.js';


// START
// TEMP: need to update testsetup to init a service so that we can get env variable
//      from the service
const useDynamoDB = String(process.env['USE_DYNAMODB']) === 'true';
let dbType: 'MONGODB'|'DYNAMODB' = 'MONGODB';
if(useDynamoDB) dbType = 'DYNAMODB';
// END



/**
 * Get the singleton AccountRepository instance
 * @returns AccountRepository instance
 */
export function getAccountRepositoryImpl(): IAccountRepository {
  if (dbType === 'DYNAMODB') {
    return new DynamoRepository();
  }
  return new MongoRepository();
}

let accountRepositoryInstance: IAccountRepository | null = null;

/**
 * Get the singleton LeaseRepository instance
 * @returns LeaseRepository instance
 */
export function getAccountRepository(): IAccountRepository {

  if (!accountRepositoryInstance) {
    accountRepositoryInstance = getAccountRepositoryImpl();
  }
  return accountRepositoryInstance;
}
