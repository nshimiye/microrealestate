import { BaseRepository } from '../../dynamo/base.js';
import { CollectionTypes } from '@microrealestate/types';

/**
 * Base repository for Template entity in DynamoDB
 */
export abstract class TemplateBaseRepository extends BaseRepository<CollectionTypes.Template> {
  protected buildPK(id: string, realmId?: string): string {
    return `REALM#${realmId}`;
  }

  protected buildSK(id: string): string {
    return `TEMPLATE#${id}`;
  }

  protected toItem(template: CollectionTypes.Template): Record<string, any> {
    return {
      PK: this.buildPK(template._id, template.realmId),
      SK: this.buildSK(template._id),
      _id: template._id,
      realmId: template.realmId,
      name: template.name,
      type: template.type,
      description: template.description,
      contents: template.contents,
      linkedResourceIds: template.linkedResourceIds,
      required: template.required,
      requiredOnceContractTerminated: template.requiredOnceContractTerminated,
      hasExpiryDate: template.hasExpiryDate,
      // Add other template fields as needed
    };
  }

  protected fromItem(item: Record<string, any>): CollectionTypes.Template {
    return {
      _id: item._id,
      realmId: item.realmId,
      name: item.name,
      type: item.type,
      description: item.description,
      contents: item.contents,
      linkedResourceIds: item.linkedResourceIds,
      required: item.required,
      requiredOnceContractTerminated: item.requiredOnceContractTerminated,
      hasExpiryDate: item.hasExpiryDate,
      // Add other template fields as needed
    } as CollectionTypes.Template;
  }
}
