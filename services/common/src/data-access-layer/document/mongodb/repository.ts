import { CollectionTypes } from '@microrealestate/types';
import DocumentModel from '../../../collections/document.js';
import { IDocumentRepository } from '../interface.js';

/**
 * MongoDB implementation of Document repository
 */
export default class MongoRepository implements IDocumentRepository {
  async findAll(realmId: string): Promise<CollectionTypes.Document[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const documents = await DocumentModel.find({ realmId }).lean();
    return documents as CollectionTypes.Document[];
  }

  async findById(
    documentId: string,
    realmId: string
  ): Promise<CollectionTypes.Document | null> {
    if (!documentId || typeof documentId !== 'string') {
      throw new Error('Document ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const document = await DocumentModel.findOne({
      _id: documentId,
      realmId: realmId
    }).lean();

    return document as CollectionTypes.Document | null;
  }

  async create(
    documentData: Partial<CollectionTypes.Document>
  ): Promise<CollectionTypes.Document> {
    if (!documentData || typeof documentData !== 'object') {
      throw new Error('Document data must be an object');
    }
    if (!documentData.realmId) {
      throw new Error('Document data must include realmId');
    }

    const doc = await DocumentModel.create(documentData);
    return doc.toObject();
  }

  async update(
    documentId: string,
    realmId: string,
    updateData: Partial<CollectionTypes.Document>
  ): Promise<CollectionTypes.Document | null> {
    if (!documentId || typeof documentId !== 'string') {
      throw new Error('Document ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }
    if (!updateData || typeof updateData !== 'object') {
      throw new Error('Update data must be an object');
    }

    const document = await DocumentModel.findOneAndUpdate(
      { _id: documentId, realmId: realmId },
      updateData,
      { new: true, lean: true }
    );

    return document as CollectionTypes.Document | null;
  }

  async deleteMany(documentIds: string[], realmId: string): Promise<number> {
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      throw new Error('Document IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const result = await DocumentModel.deleteMany({
      realmId: realmId,
      _id: { $in: documentIds }
    });

    return result.deletedCount || 0;
  }

  async findByIds(
    documentIds: string[],
    realmId: string
  ): Promise<CollectionTypes.Document[]> {
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      throw new Error('Document IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const documents = await DocumentModel.find({
      _id: { $in: documentIds },
      realmId: realmId
    }).lean();

    return documents as CollectionTypes.Document[];
  }

  async findByTenantIds(
    tenantIds: string[],
    realmId: string,
    projection?: Record<string, number>
  ): Promise<CollectionTypes.Document[]> {
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      throw new Error('Tenant IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    let query = DocumentModel.find({
      realmId: realmId,
      tenantId: { $in: tenantIds }
    });

    if (projection) {
      query = query.select(projection);
    }

    const documents = await query.lean();
    return documents as CollectionTypes.Document[];
  }
}
