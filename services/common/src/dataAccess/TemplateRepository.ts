import { CollectionTypes } from '@microrealestate/types';
import TemplateModel from '../collections/template.js';
import mongoose from 'mongoose';

/**
 * Repository for Template entity operations
 * 
 * Provides an abstraction layer over Mongoose Template model,
 * returning plain JavaScript objects instead of Mongoose documents.
 * All operations are realm-scoped to ensure multi-tenancy security.
 */
export default class TemplateRepository {
  /**
   * Find all templates in a realm
   * 
   * Retrieves all templates that belong to the specified realm.
   * 
   * @param realmId - Realm ID for security filtering
   * @returns Array of template objects (may be empty if no matches found)
   * @throws Error if realmId is invalid
   * 
   * @example
   * ```typescript
   * const templates = await templateRepository.findAll('507f1f77bcf86cd799439011');
   * console.log(`Found ${templates.length} templates`);
   * ```
   */
  async findAll(realmId: string): Promise<CollectionTypes.Template[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const templates = await TemplateModel.find({ realmId }).lean();
    return templates as CollectionTypes.Template[];
  }

  /**
   * Find a single template by ID and realm
   * 
   * @param templateId - Template ID
   * @param realmId - Realm ID for security filtering
   * @returns Template object or null if not found
   * @throws Error if templateId or realmId is invalid
   * 
   * @example
   * ```typescript
   * const template = await templateRepository.findById(
   *   '507f1f77bcf86cd799439011',
   *   '507f1f77bcf86cd799439012'
   * );
   * if (template) {
   *   console.log(template.name);
   * }
   * ```
   */
  async findById(
    templateId: string,
    realmId: string
  ): Promise<CollectionTypes.Template | null> {
    if (!templateId || typeof templateId !== 'string') {
      throw new Error('Template ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const template = await TemplateModel.findOne({
      _id: templateId,
      realmId: realmId
    }).lean();

    return template as CollectionTypes.Template | null;
  }

  /**
   * Create a new template
   * 
   * Creates a new template in the database and returns it as a plain object.
   * 
   * @param templateData - Template creation data (must include realmId)
   * @returns Created template object
   * @throws Error if templateData is invalid or missing realmId
   * 
   * @example
   * ```typescript
   * const newTemplate = await templateRepository.create({
   *   realmId: '507f1f77bcf86cd799439011',
   *   name: 'Rental Contract',
   *   type: 'text',
   *   description: 'Standard rental contract template',
   *   contents: { ... }
   * });
   * console.log(`Created template: ${newTemplate.name}`);
   * ```
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

    const template = await TemplateModel.create(templateData);
    return template.toObject();
  }

  /**
   * Replace an existing template
   * 
   * Replaces a template entirely with new data and returns the replaced template.
   * This is equivalent to findOneAndReplace.
   * 
   * @param templateId - Template ID to replace
   * @param realmId - Realm ID for security filtering
   * @param templateData - New template data
   * @returns Replaced template object or null if not found
   * @throws Error if templateId, realmId, or templateData is invalid
   * 
   * @example
   * ```typescript
   * const replaced = await templateRepository.replace(
   *   '507f1f77bcf86cd799439011',
   *   '507f1f77bcf86cd799439012',
   *   {
   *     realmId: '507f1f77bcf86cd799439012',
   *     name: 'Updated Contract',
   *     type: 'text',
   *     contents: { ... }
   *   }
   * );
   * if (replaced) {
   *   console.log(`Replaced template: ${replaced.name}`);
   * }
   * ```
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

    const template = await TemplateModel.findOneAndReplace(
      { _id: templateId, realmId: realmId },
      templateData,
      { new: true, lean: true }
    );

    return template as CollectionTypes.Template | null;
  }

  /**
   * Find templates linked to specific resources (leases)
   * 
   * @param resourceIds - Array of resource IDs (lease IDs)
   * @param realmId - Realm ID
   * @returns Array of template objects
   * @throws Error if resourceIds or realmId is invalid
   * 
   * @example
   * ```typescript
   * const templates = await templateRepository.findByLinkedResources(
   *   ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
   *   '507f1f77bcf86cd799439013'
   * );
   * ```
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

    const templates = await TemplateModel.find({
      realmId: realmId,
      linkedResourceIds: { $in: resourceIds }
    }).lean();

    return templates as CollectionTypes.Template[];
  }

  /**
   * Delete multiple templates
   * 
   * @param templateIds - Array of template IDs to delete
   * @param realmId - Realm ID
   * @param session - Optional database session for transactions
   * @returns Number of templates deleted
   * @throws Error if templateIds or realmId is invalid
   * 
   * @example
   * ```typescript
   * const count = await templateRepository.deleteMany(
   *   ['507f1f77bcf86cd799439011'],
   *   '507f1f77bcf86cd799439012',
   *   session
   * );
   * ```
   */
  async deleteMany(
    templateIds: string[],
    realmId: string,
    session?: mongoose.ClientSession
  ): Promise<number> {
    if (!Array.isArray(templateIds) || templateIds.length === 0) {
      throw new Error('Template IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const result = await TemplateModel.deleteMany(
      { _id: { $in: templateIds }, realmId: realmId },
      { session: session as any }
    );

    return result.deletedCount || 0;
  }

  /**
   * Update multiple templates
   * 
   * @param filter - Query filter
   * @param update - Update operations
   * @param session - Optional database session for transactions
   * @returns Number of templates modified
   * @throws Error if filter or update is invalid
   * 
   * @example
   * ```typescript
   * const count = await templateRepository.updateMany(
   *   { realmId: '507f1f77bcf86cd799439011', linkedResourceIds: { $in: leaseIds } },
   *   { $pull: { linkedResourceIds: { $in: leaseIds } } },
   *   session
   * );
   * ```
   */
  async updateMany(
    filter: Record<string, any>,
    update: Record<string, any>,
    session?: mongoose.ClientSession
  ): Promise<number> {
    if (!filter || typeof filter !== 'object') {
      throw new Error('Filter must be an object');
    }
    if (!update || typeof update !== 'object') {
      throw new Error('Update must be an object');
    }

    const result = await TemplateModel.updateMany(
      filter,
      update,
      { session: session as any }
    );

    return result.modifiedCount || 0;
  }
}
