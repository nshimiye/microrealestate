import { CollectionTypes } from '@microrealestate/types';
import TemplateModel from '../collections/template.js';
import mongoose from 'mongoose';

/**
 * Repository for Template entity operations
 * 
 * Provides an abstraction layer over Mongoose Template model,
 * returning plain JavaScript objects instead of Mongoose documents.
 */
export default class TemplateRepository {
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
