import MongoRepository from './mongodb/repository.js';
import DynamoRepository from './dynamodb/repository.js';

import { IRealmRepository } from './interface.js';
// import Service from '../../utils/service.js';

export { IRealmRepository } from './interface.js';

// added to unit test getRealmRepository
export {default as RealmMongoRepository} from './mongodb/repository.js';

// START
// TEMP: need to update testsetup to init a service so that we can get env variable
//      from the service
const useDynamoDB = String(process.env['USE_DYNAMODB']) === 'true';
let dbType: 'MONGODB'|'DYNAMODB' = 'MONGODB';
if(useDynamoDB) dbType = 'DYNAMODB';
// END


/**
 * Get the singleton RealmRepository instance
 * @returns RealmRepository instance
 */
export function getRealmRepositoryImpl(): IRealmRepository {
    // const service = Service.getInstance();
    // const { USE_DYNAMODB } = service.envConfig.getValues();

    if (dbType === 'DYNAMODB') {
      return new DynamoRepository();
    }
    return new MongoRepository();
}


let realmRepositoryInstance: IRealmRepository | null = null;
/**
 * Get the singleton RealmRepository instance
 * @returns RealmRepository instance
 */
export function getRealmRepository(): IRealmRepository {
  if (!realmRepositoryInstance) {
    realmRepositoryInstance = getRealmRepositoryImpl();
  }
  return realmRepositoryInstance;
}