import MongoRepository from './mongodb/repository.js';
import DynamoRepository from './dynamodb/repository.js';
import { IDocumentRepository } from './interface.js';
// import Service from '../../utils/service.js';

export { IDocumentRepository } from './interface.js';

// Export for testing
export { default as DocumentMongoRepository } from './mongodb/repository.js';



// START
// TEMP: need to update testsetup to init a service so that we can get env variable
//      from the service
const useDynamoDB = String(process.env['USE_DYNAMODB']) === 'true';
let dbType: 'MONGODB'|'DYNAMODB' = 'MONGODB';
if(useDynamoDB) dbType = 'DYNAMODB';
// END




/**
 * Get the singleton DocumentRepository instance
 * @returns DocumentRepository instance
 */
export function getDocumentRepositoryImpl(): IDocumentRepository {
if (dbType === 'DYNAMODB') {
    return new DynamoRepository();
  }
  return new MongoRepository();
}

let documentRepositoryInstance: IDocumentRepository | null = null;

/**
 * Get the singleton LeaseRepository instance
 * @returns LeaseRepository instance
 */
export function getDocumentRepository(): IDocumentRepository {

  if (!documentRepositoryInstance) {
    documentRepositoryInstance = getDocumentRepositoryImpl();
  }
  return documentRepositoryInstance;
}
