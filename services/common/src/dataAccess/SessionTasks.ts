import logger from "../utils/logger.js";
import axios from 'axios';

import { getDocumentRepository, getLeaseRepository, getTemplateRepository, getTenantRepository } from "./repository.js";
import SessionManager from "./SessionManager.js";

export default class SessionTasks {
    constructor(private sessionManager: SessionManager) {}

    async deleteManyLeases(leaseIds: string[], templateIdsToRemove:string[], realm: {_id:string}) {
         const leaseRepository = getLeaseRepository();
          const templateRepository = getTemplateRepository();

            await this.sessionManager.withTransaction(async (session) => {
            // let session = undefined;
              await Promise.all([
                leaseRepository.deleteMany(leaseIds, realm._id, session),
                templateIdsToRemove.length > 0 
                  ? templateRepository.deleteMany(templateIdsToRemove, realm._id, session)
                  : Promise.resolve(0),
                templateRepository.updateMany(
                  {
                    realmId: realm._id,
                    linkedResourceIds: { $in: leaseIds }
                  },
                  {
                    // remove leaseIds from linkedResourceIds
                    $pull: { linkedResourceIds: { $in: leaseIds } }
                  },
                  session
                )
              ]);
            });
    }

    async deleteManyTenants(occupantIds:string[], options: {realm: {_id:string}, PDFGENERATOR_URL: string, pdfHeaders: Record<string, string>}) {
        const { realm, PDFGENERATOR_URL, pdfHeaders } = options;

            await this.sessionManager.withTransaction(async (_session) => {
              // Use repository to find documents
              const documentRepository = getDocumentRepository();  
              const tenantRepository = getTenantRepository();
              
              const documents = await documentRepository.findByTenantIds(
                occupantIds,
                realm._id,
                { _id: 1 }
              );
        
              // Keep PDF generator service call via axios
              const documentsEndPoint = `${PDFGENERATOR_URL}/documents/${documents
                .map(({ _id }) => _id)
                .join(',')}`;
              try {
                await axios.delete(documentsEndPoint, {
                  headers: pdfHeaders
                });
              } catch (e) {
                const error = e as {response?:any,message:string}
                const errorMessage = error.response?.data?.message || error.message;
                logger.error('DELETE documents failed');
                logger.error(errorMessage);
              }
        
              // Use repository to delete tenants
              await tenantRepository.deleteMany(occupantIds, realm._id);
            });
    }
}

