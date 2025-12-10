import { TemplateBaseRepository } from './base-repository.js';
import { ITemplateRepository, IDataBaseSession } from '../interface.js';
import { CollectionTypes } from '@microrealestate/types';
import logger from '../../../utils/logger.js';
import { randomUUID } from 'crypto';

/**
 * DynamoDB implementation of Template repository
 */
export default class DynamoRepository
  extends TemplateBaseRepository
  implements ITemplateRepository
{
  /**
   * Create a new template
   * Generates UUID for template ID if not provided
   */
  async create(
    templateData: Partial<CollectionTypes.Template>
  ): Promise<CollectionTypes.Template> {
    if (!templateData || typeof templateData !== 'object') {
      throw new Error('Template data must be an object');
    }
    if (!templateData.realmId) {
      throw new Error('Template data must include realmId');
    }

    // Extract ID generation to separate variable
    const templateId = templateData._id || randomUUID();
    
    // Validate that templateId is defined
    if (!templateId) {
      throw new Error('Failed to generate template ID');
    }

    // Create template with validated ID
    const template = {
      ...templateData,
      _id: templateId
    } as CollectionTypes.Template;

    return super.create(template);
  }
  /**
   * Find all templates in a realm
   * Uses base class findByRealm method with TEMPLATE# prefix
   *
   * @param realmId - Realm ID for security filtering
   * @returns Array of template objects
   * @throws Error if realmId is invalid
   */
  async findAll(realmId: string): Promise<CollectionTypes.Template[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      const templates = await this.findByRealm(realmId);

      logger.debug('Found templates in realm', {
        realmId,
        count: templates.length
      });

      return templates;
    } catch (error) {
      logger.error('Failed to find templates', { realmId, error });
      throw error;
    }
  }

  /**
   * Replace an existing template
   * Deletes the old template and creates a new one with the provided data
   *
   * @param templateId - Template ID to replace
   * @param realmId - Realm ID for security filtering
   * @param templateData - New template data
   * @returns Replaced template object or null if not found
   * @throws Error if templateId, realmId, or templateData is invalid
   */
  async replace(
    templateId: string,
    realmId: string,
    templateData: Partial<CollectionTypes.Template>
  ): Promise<CollectionTypes.Template | null> {
    if (!templateId || typeof templateId !== 'string') {
      throw new Error('Template ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }
    if (!templateData || typeof templateData !== 'object') {
      throw new Error('Template data must be an object');
    }

    try {
      // First check if the template exists
      const existingTemplate = await this.findById(templateId, realmId);
      if (!existingTemplate) {
        logger.debug('Template not found for replacement', {
          templateId,
          realmId
        });
        return null;
      }

      // Delete the existing template
      await this.delete(templateId, realmId);

      // Create the new template with the provided data
      const newTemplate: CollectionTypes.Template = {
        _id: templateId,
        realmId: realmId,
        ...templateData
      } as CollectionTypes.Template;

      const replacedTemplate = await this.create(newTemplate);

      logger.debug('Template replaced successfully', {
        templateId,
        realmId
      });

      return replacedTemplate;
    } catch (error) {
      logger.error('Failed to replace template', {
        templateId,
        realmId,
        error
      });
      throw error;
    }
  }

  /**
   * Find templates linked to specific resources (leases)
   * Uses query with filter expression to match linkedResourceIds
   *
   * @param resourceIds - Array of resource IDs (lease IDs)
   * @param realmId - Realm ID
   * @returns Array of template objects
   * @throws Error if resourceIds or realmId is invalid
   */
  async findByLinkedResources(
    resourceIds: string[],
    realmId: string
  ): Promise<CollectionTypes.Template[]> {
    if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
      throw new Error('Resource IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      // Query all templates in the realm
      const allTemplates = await this.findByRealm(realmId);

      // Filter templates that have at least one matching linkedResourceId
      const matchingTemplates = allTemplates.filter((template) => {
        if (!template.linkedResourceIds || template.linkedResourceIds.length === 0) {
          return false;
        }
        // Check if any of the template's linkedResourceIds match any of the requested resourceIds
        return template.linkedResourceIds.some((linkedId) =>
          resourceIds.includes(linkedId)
        );
      });

      logger.debug('Found templates by linked resources', {
        realmId,
        resourceIds,
        count: matchingTemplates.length
      });

      return matchingTemplates;
    } catch (error) {
      logger.error('Failed to find templates by linked resources', {
        realmId,
        resourceIds,
        error
      });
      throw error;
    }
  }

  /**
   * Delete multiple templates
   * Uses batch delete operations for efficiency
   *
   * @param templateIds - Array of template IDs to delete
   * @param realmId - Realm ID
   * @param session - Optional database session for transactions (not used in DynamoDB)
   * @returns Number of templates deleted
   * @throws Error if templateIds or realmId is invalid
   */
  async deleteMany(
    templateIds: string[],
    realmId: string,
    session?: IDataBaseSession
  ): Promise<number> {
    if (!Array.isArray(templateIds) || templateIds.length === 0) {
      throw new Error('Template IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    try {
      // Build delete requests for batch operation
      const deleteRequests = templateIds.map((templateId) => ({
        deleteRequest: {
          PK: this.buildPK(templateId, realmId),
          SK: this.buildSK(templateId)
        }
      }));

      // Execute batch delete
      const result = await this.client.batchWrite(deleteRequests);

      // Calculate number of successfully deleted items
      const deletedCount = templateIds.length - result.unprocessedItems.length;

      if (result.unprocessedItems.length > 0) {
        logger.warn('Some templates could not be deleted', {
          realmId,
          unprocessedCount: result.unprocessedItems.length,
          totalRequested: templateIds.length
        });
      }

      logger.debug('Templates deleted', {
        realmId,
        deletedCount,
        requestedCount: templateIds.length
      });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete templates', { realmId, error });
      throw error;
    }
  }

  /**
   * Update multiple templates
   * Queries templates matching the filter, updates each one, and batch writes them
   *
   * @param filter - Query filter (must include realmId)
   * @param update - Update operations
   * @param session - Optional database session for transactions (not used in DynamoDB)
   * @returns Number of templates modified
   * @throws Error if filter or update is invalid
   */
  async updateMany(
    filter: Record<string, any>,
    update: Record<string, any>,
    session?: IDataBaseSession
  ): Promise<number> {
    if (!filter || typeof filter !== 'object') {
      throw new Error('Filter must be an object');
    }
    if (!update || typeof update !== 'object') {
      throw new Error('Update must be an object');
    }
    if (!filter.realmId) {
      throw new Error('Filter must include realmId');
    }

    try {
      const realmId = filter.realmId;

      // Query all templates in the realm
      const allTemplates = await this.findByRealm(realmId);

      // Filter templates based on the filter criteria
      const matchingTemplates = allTemplates.filter((template) => {
        // Check each filter condition
        for (const [key, value] of Object.entries(filter)) {
          if (key === 'realmId') continue; // Already filtered by realm

          // Handle $in operator
          if (typeof value === 'object' && value.$in) {
            if (!value.$in.includes((template as any)[key])) {
              return false;
            }
          } else {
            // Direct equality check
            if ((template as any)[key] !== value) {
              return false;
            }
          }
        }
        return true;
      });

      if (matchingTemplates.length === 0) {
        logger.debug('No templates matched the filter', { filter });
        return 0;
      }

      // Apply updates to each matching template
      const updatedTemplates = matchingTemplates.map((template) => {
        const updatedTemplate = { ...template };

        // Handle $set operator
        if (update.$set) {
          Object.assign(updatedTemplate, update.$set);
        } else {
          // Direct field updates
          Object.assign(updatedTemplate, update);
        }

        return updatedTemplate;
      });

      // Build put requests for batch operation
      const putRequests = updatedTemplates.map((template) => ({
        putRequest: this.toItem(template)
      }));

      // Execute batch write
      const result = await this.client.batchWrite(putRequests);

      // Calculate number of successfully updated items
      const updatedCount =
        updatedTemplates.length - result.unprocessedItems.length;

      if (result.unprocessedItems.length > 0) {
        logger.warn('Some templates could not be updated', {
          realmId,
          unprocessedCount: result.unprocessedItems.length,
          totalRequested: updatedTemplates.length
        });
      }

      logger.debug('Templates updated', {
        realmId,
        updatedCount,
        requestedCount: updatedTemplates.length
      });

      return updatedCount;
    } catch (error) {
      logger.error('Failed to update templates', { filter, error });
      throw error;
    }
  }
}
