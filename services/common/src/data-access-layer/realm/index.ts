import MongoRepository from './mongodb/repository.js';
import DynamoRepository from './dynamodb/repository.js';

import { IRealmRepository } from './interface.js';
import Service from '../../utils/service.js';

export { IRealmRepository } from './interface.js';

// added to unit test getRealmRepository
export {default as RealmMongoRepository} from './mongodb/repository.js';

/**
 * Get the singleton RealmRepository instance
 * @returns RealmRepository instance
 */
export function getRealmRepository(): IRealmRepository {
    const service = Service.getInstance();
    const { USE_DYNAMODB } = service.envConfig.getValues();
    const useDynamoDB = USE_DYNAMODB && String(USE_DYNAMODB) === 'true';

    if (useDynamoDB) {
      return new DynamoRepository();
    }
    return new MongoRepository();
}
