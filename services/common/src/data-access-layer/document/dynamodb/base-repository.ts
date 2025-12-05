import { BaseRepository } from '../../dynamo/base.js';
import { CollectionTypes } from '@microrealestate/types';

/**
 * Base repository for Document entity in DynamoDB
 */
export abstract class DocumentBaseRepository extends BaseRepository<CollectionTypes.Document> {
  protected buildPK(id: string, realmId?: string): string {
    return `REALM#${realmId}`;
  }

  protected buildSK(id: string): string {
    return `DOCUMENT#${id}`;
  }

  protected toItem(document: CollectionTypes.Document): Record<string, any> {
    return {
      PK: this.buildPK(document._id, document.realmId),
      SK: this.buildSK(document._id),
      _id: document._id,
      realmId: document.realmId,
      tenantId: document.tenantId,
      leaseId: document.leaseId,
      type: document.type,
      name: document.name,
      description: document.description,
      mimeType: document.mimeType,
      expiryDate: document.expiryDate,
      url: document.url,
      templateId: document.templateId,
      // Add other document fields as needed
    };
  }

  protected fromItem(item: Record<string, any>): CollectionTypes.Document {
    return {
      _id: item._id,
      realmId: item.realmId,
      tenantId: item.tenantId,
      leaseId: item.leaseId,
      type: item.type,
      name: item.name,
      description: item.description,
      mimeType: item.mimeType,
      expiryDate: item.expiryDate,
      url: item.url,
      templateId: item.templateId,
      // Add other document fields as needed
    } as CollectionTypes.Document;
  }
}
