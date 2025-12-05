import { CollectionTypes } from '@microrealestate/types';
import mongoose from 'mongoose';
import TemplateModel from '../../../collections/template.js';
import { ITemplateRepository, IDataBaseSession } from '../interface.js';

/**
 * MongoDB implementation of Template repository
 */
export default class MongoRepository implements ITemplateRepository {
  async findAll(realmId: string): Promise<CollectionTypes.Template[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const templates = await TemplateModel.find({ realmId }).lean();
    return templates as CollectionTypes.Template[];
  }

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

    const result = await TemplateModel.deleteMany(
      { _id: { $in: templateIds }, realmId: realmId },
      // { session: session as any }
    );

    return result.deletedCount || 0;
  }

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

    const result = await TemplateModel.updateMany(
      filter,
      update,
      // { session: session as any }
    );

    return result.modifiedCount || 0;
  }
}
