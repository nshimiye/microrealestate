import MongoRepository from './mongodb/repository.js';
import DynamoRepository from './dynamodb/repository.js';

import { ILeaseRepository } from './interface.js';
export { ILeaseRepository } from './interface.js';
// import Service from '../../utils/service.js';


// added to unit test getRealmRepository
export {default as LeaseMongoRepository} from './mongodb/repository.js';

// START
// TEMP: need to update testsetup to init a service so that we can get env variable
//      from the service
const useDynamoDB = String(process.env['USE_DYNAMODB']) === 'true';
let dbType: 'MONGODB'|'DYNAMODB' = 'MONGODB';
if(useDynamoDB) dbType = 'DYNAMODB';
// END

/**
 * Get the singleton LeaseRepository instance
 * @returns LeaseRepository instance
 */
export function getLeaseRepositoryImpl(): ILeaseRepository {
    // const service = Service.getInstance();
    // const { USE_DYNAMODB } = service.envConfig.getValues();
    // const useDynamoDB = USE_DYNAMODB && String(USE_DYNAMODB) === 'true';

    if (dbType === 'DYNAMODB') {
      return new DynamoRepository();
    }
    return new MongoRepository();
}

let leaseRepositoryInstance: ILeaseRepository | null = null;

/**
 * Get the singleton LeaseRepository instance
 * @returns LeaseRepository instance
 */
export function getLeaseRepository(): ILeaseRepository {

  if (!leaseRepositoryInstance) {
    leaseRepositoryInstance = getLeaseRepositoryImpl();
  }
  return leaseRepositoryInstance;
}