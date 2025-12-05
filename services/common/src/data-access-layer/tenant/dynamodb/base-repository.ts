import { BaseRepository } from '../../dynamo/base.js';
import { CollectionTypes } from '@microrealestate/types';

/**
 * Base repository for Tenant entity in DynamoDB
 */
export abstract class TenantBaseRepository extends BaseRepository<CollectionTypes.Tenant> {
  protected buildPK(id: string, realmId?: string): string {
    return `REALM#${realmId}`;
  }

  protected buildSK(id: string): string {
    return `TENANT#${id}`;
  }

  protected toItem(tenant: CollectionTypes.Tenant): Record<string, any> {
    return {
      PK: this.buildPK(tenant._id, String(tenant.realmId)),
      SK: this.buildSK(tenant._id),
      _id: tenant._id,
      realmId: tenant.realmId,
      name: tenant.name,
      leaseId: tenant.leaseId,
      properties: tenant.properties,
      contacts: tenant.contacts,
      rents: tenant.rents,
      beginDate: tenant.beginDate,
      endDate: tenant.endDate,
      terminationDate: tenant.terminationDate,
      guaranty: tenant.guaranty,
      guarantyPayback: tenant.guarantyPayback,
      reference: tenant.reference,
      // Add other tenant fields as needed
    };
  }

  protected fromItem(item: Record<string, any>): CollectionTypes.Tenant {
    return {
      _id: item._id,
      realmId: item.realmId,
      name: item.name,
      leaseId: item.leaseId,
      properties: item.properties,
      contacts: item.contacts,
      rents: item.rents,
      beginDate: item.beginDate,
      endDate: item.endDate,
      terminationDate: item.terminationDate,
      guaranty: item.guaranty,
      guarantyPayback: item.guarantyPayback,
      reference: item.reference,
      // Add other tenant fields as needed
    } as CollectionTypes.Tenant;
  }
}
