import MongoRepository from './mongodb/repository.js';
import DynamoRepository from './dynamodb/repository.js';

import { ILeaseRepository } from './interface.js';
export { ILeaseRepository } from './interface.js';
import Service from '../../utils/service.js';


// added to unit test getRealmRepository
export {default as LeaseMongoRepository} from './mongodb/repository.js';

/**
 * Get the singleton LeaseRepository instance
 * @returns LeaseRepository instance
 */
export function getLeaseRepository(): ILeaseRepository {
    const service = Service.getInstance();
    const { USE_DYNAMODB } = service.envConfig.getValues();
    const useDynamoDB = USE_DYNAMODB && String(USE_DYNAMODB) === 'true';

    if (useDynamoDB) {
      return new DynamoRepository();
    }
    return new MongoRepository();
}
