import { BaseOthersCRUDRepository } from '../../dynamo/base-others-crud.js';
import { BaseRepository } from '../../dynamo/base.js';
import { CollectionTypes } from '@microrealestate/types';

/**
 * Base repository for Template entity in DynamoDB
 */
export abstract class TemplateBaseRepository extends BaseOthersCRUDRepository<CollectionTypes.Template> {
  /**
   * Build partition key for Template entity.
   * Format: REALM#<realmId>
   *
   * @param templateId The template identifier (not used for PK)
   * @param realmId The realm identifier
   * @returns The partition key
   */
  protected buildPK(templateId: string, realmId?: string): string {
    if (!realmId) {
      throw new Error('realmId is required for Template entities');
    }
    return `REALM#${realmId}`;
  }

  /**
   * Build sort key for Template entity.
   * Format: TEMPLATE#<templateId>
   *
   * @param templateId The template identifier
   * @returns The sort key
   */
  protected buildSK(templateId: string): string {
    return `TEMPLATE#${templateId}`;
  }

  /**
   * Transform Template entity to DynamoDB item.
   * Preserves all fields including contents, html, and configuration flags.
   *
   * @param entity The Template entity
   * @returns The DynamoDB item
   */
  protected toItem(entity: CollectionTypes.Template): Record<string, any> {
    const templateId = entity._id;
    const realmId = entity.realmId;

    const item: Record<string, any> = {
      PK: this.buildPK(templateId, realmId),
      SK: this.buildSK(templateId),
      EntityType: 'Template',
      RealmId: realmId,
      TemplateId: templateId,

      // Template metadata
      Name: entity.name,
      Type: entity.type,
      Description: entity.description,
      HasExpiryDate: entity.hasExpiryDate,

      // Template content
      Contents: entity.contents,
      Html: entity.html,

      // Configuration
      LinkedResourceIds: entity.linkedResourceIds,
      Required: entity.required,
      RequiredOnceContractTerminated: entity.requiredOnceContractTerminated
    };

    return item;
  }

  /**
   * Transform DynamoDB item to Template entity.
   * Restores all fields from DynamoDB format.
   *
   * @param item The DynamoDB item
   * @returns The Template entity
   */
  protected fromItem(item: Record<string, any>): CollectionTypes.Template {
    return {
      _id: item.TemplateId,
      realmId: item.RealmId,

      // Template metadata
      name: item.Name,
      type: item.Type,
      description: item.Description,
      hasExpiryDate: item.HasExpiryDate,

      // Template content
      contents: item.Contents,
      html: item.Html,

      // Configuration
      linkedResourceIds: item.LinkedResourceIds || [],
      required: item.Required,
      requiredOnceContractTerminated: item.RequiredOnceContractTerminated
    };
  }

  /**
   * Find all templates for a given realm.
   * Uses the base repository's findByRealm method with TEMPLATE# prefix.
   *
   * @param realmId The realm identifier
   * @returns Array of templates in the realm
   * @throws ServiceError if query fails
   */
  async findByRealm(realmId: string): Promise<CollectionTypes.Template[]> {
    return super.findByRealm(realmId, 'TEMPLATE#');
  }

  /**
   * Create a new template.
   * Overrides base method for clarity and validation.
   *
   * @param entity The template to create
   * @returns The created template
   * @throws ServiceError if creation fails or realmId is missing
   */
  async create(
    entity: CollectionTypes.Template
  ): Promise<CollectionTypes.Template> {
    const realmId = entity.realmId;

    if (!realmId) {
      throw new Error('realmId is required to create a Template');
    }

    return super.create(entity);
  }

  /**
   * Find template by ID.
   * Requires realmId for partition key construction.
   *
   * @param templateId The template identifier
   * @param realmId The realm identifier
   * @returns The template if found, null otherwise
   * @throws Error if realmId is not provided
   */
  async findById(
    templateId: string,
    realmId: string
  ): Promise<CollectionTypes.Template | null> {
    if (!realmId) {
      throw new Error('realmId is required to find a Template by ID');
    }
    return super.findById(templateId, realmId);
  }

  /**
   * Update a template.
   * Requires realmId for partition key construction.
   *
   * @param templateId The template identifier
   * @param updates Partial template updates
   * @param realmId The realm identifier
   * @returns The updated template
   * @throws Error if realmId is not provided
   */
  async update(
    templateId: string,
    realmId: string,
    updates: Partial<CollectionTypes.Template>
  ): Promise<CollectionTypes.Template | null> {
    if (!realmId) {
      throw new Error('realmId is required to update a Template');
    }

    return super.update(templateId, realmId, updates);
  }

  /**
   * Delete a template.
   * Requires realmId for partition key construction.
   *
   * @param templateId The template identifier
   * @param realmId The realm identifier
   * @throws Error if realmId is not provided
   */
  async delete(templateId: string, realmId?: string): Promise<void> {
    if (!realmId) {
      throw new Error('realmId is required to delete a Template');
    }
    return super.delete(templateId, realmId);
  }
}
