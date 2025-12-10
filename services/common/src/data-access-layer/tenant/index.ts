import MongoRepository from './mongodb/repository.js';
import DynamoRepository from './dynamodb/repository.js';
import { ITenantRepository } from './interface.js';
// import Service from '../../utils/service.js';

export { ITenantRepository } from './interface.js';

// Export for testing
export { default as TenantMongoRepository } from './mongodb/repository.js';


// START
// TEMP: need to update testsetup to init a service so that we can get env variable
//      from the service
const useDynamoDB = String(process.env['USE_DYNAMODB']) === 'true';
let dbType: 'MONGODB'|'DYNAMODB' = 'MONGODB';
if(useDynamoDB) dbType = 'DYNAMODB';
// END


/**
 * Get the singleton TenantRepository instance
 * @returns TenantRepository instance
 */
export function getTenantRepositoryImpl(): ITenantRepository {
if (dbType === 'DYNAMODB') {
    return new DynamoRepository();
  }
  return new MongoRepository();
}

let tenantRepositoryInstance: ITenantRepository | null = null;
/**
 * Get the singleton RealmRepository instance
 * @returns RealmRepository instance
 */
export function getTenantRepository(): ITenantRepository {
  if (!tenantRepositoryInstance) {
    tenantRepositoryInstance = getTenantRepositoryImpl();
  }
  return tenantRepositoryInstance;
}
