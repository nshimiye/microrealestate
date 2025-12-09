import { CollectionTypes } from '@microrealestate/types';
import { ObjectId } from '../../../collections/index.js';
import TenantModel from '../../../collections/tenant.js';
import { ITenantRepository } from '../interface.js';

interface FileDescriptorWithDocuments {
  _id: string;
  name: string;
  description: string;
  required: boolean;
  requiredOnceContractTerminated: boolean;
  documents: Array<Partial<Document>>;
  missing?: boolean;
}

interface TenantWithFileDescriptors extends CollectionTypes.Tenant {
  filesToUpload: FileDescriptorWithDocuments[];
}

/**
 * MongoDB implementation of Tenant repository
 */
export default class MongoRepository implements ITenantRepository {
  async findByContactEmail(email: string): Promise<CollectionTypes.Tenant[]> {
    if (!email || typeof email !== 'string') {
      throw new Error('Email must be a non-empty string');
    }

    const tenants = await TenantModel.find({
      'contacts.email': email
    }).lean();

    return tenants as CollectionTypes.Tenant[];
  }

  async findById(id: string): Promise<CollectionTypes.Tenant | null> {
    if (!id || typeof id !== 'string') {
      throw new Error('ID must be a non-empty string');
    }

    const tenant = await TenantModel.findById(id).lean();
    return tenant as CollectionTypes.Tenant | null;
  }

  async find(
    filter: {
      realmId: string;
      tenantId?: string;
      startTerm?: number;
      endTerm?: number;
    },
    options?: { sort?: { name?: 'asc' | 'desc' } }
  ): Promise<CollectionTypes.Tenant[]> {
    if (!filter?.realmId || typeof filter.realmId !== 'string') {
      throw new Error('realmId is required and must be a string');
    }

    const mongoQuery: any = {
      $and: [{ realmId: filter.realmId }]
    };

    if (filter.tenantId) {
      mongoQuery.$and.push({ _id: filter.tenantId });
    }

    if (filter.startTerm && filter.endTerm) {
      mongoQuery.$and.push({ 'rents.term': { $gte: filter.startTerm } });
      mongoQuery.$and.push({ 'rents.term': { $lte: filter.endTerm } });
    } else if (filter.startTerm) {
      mongoQuery.$and.push({ 'rents.term': filter.startTerm });
    }

    let query = TenantModel.find(mongoQuery);

    if (options?.sort?.name) {
      query = query.sort({ name: options.sort.name === 'asc' ? 1 : -1 });
    }

    const tenants = await query.lean();
    return tenants as CollectionTypes.Tenant[];
  }

  async findOne(filter: {
    tenantId: string;
    realmId: string;
  }): Promise<CollectionTypes.Tenant | null> {
    if (!filter?.tenantId || typeof filter.tenantId !== 'string') {
      throw new Error('tenantId is required and must be a string');
    }
    if (!filter?.realmId || typeof filter.realmId !== 'string') {
      throw new Error('realmId is required and must be a string');
    }

    const tenant = await TenantModel.findOne({
      _id: filter.tenantId,
      realmId: filter.realmId
    }).lean();

    return tenant as CollectionTypes.Tenant | null;
  }

  async findOneAndUpdate(
    filter: {
      tenantId: string;
      realmId: string;
    },
    update: Partial<CollectionTypes.Tenant>,
    options?: { returnUpdated?: boolean }
  ): Promise<CollectionTypes.Tenant | null> {
    if (!filter?.tenantId || typeof filter.tenantId !== 'string') {
      throw new Error('tenantId is required and must be a string');
    }
    if (!filter?.realmId || typeof filter.realmId !== 'string') {
      throw new Error('realmId is required and must be a string');
    }
    if (!update || typeof update !== 'object') {
      throw new Error('Update must be an object');
    }

    const tenant = await TenantModel.findOneAndUpdate(
      { _id: filter.tenantId, realmId: filter.realmId },
      update,
      { new: options?.returnUpdated ?? false, lean: true }
    );

    return tenant as CollectionTypes.Tenant | null;
  }

  async findByPropertyIds(
    propertyIds: string[],
    realmId: string
  ): Promise<CollectionTypes.Tenant[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    if (!Array.isArray(propertyIds)) {
      throw new Error('Property IDs must be a non-empty array');
    }
    if (propertyIds.length === 0) {
      return [];
    }

    const tenants = await TenantModel.find({
      realmId: realmId,
      'properties.propertyId': {
        $in: propertyIds
      }
    }).lean();

    return tenants as CollectionTypes.Tenant[];
  }

  async create(
    tenantData: Partial<CollectionTypes.Tenant>
  ): Promise<CollectionTypes.Tenant> {
    if (!tenantData || typeof tenantData !== 'object') {
      throw new Error('Tenant data must be an object');
    }
    if (!tenantData.realmId) {
      throw new Error('Tenant data must include realmId');
    }

    const doc = await TenantModel.create(tenantData);
    return doc.toObject();
  }

  async update(
    tenantId: string,
    realmId: string,
    updateData: Partial<CollectionTypes.Tenant>
  ): Promise<CollectionTypes.Tenant | null> {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('Tenant ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }
    if (!updateData || typeof updateData !== 'object') {
      throw new Error('Update data must be an object');
    }

    // const result = await TenantModel.updateOne(
    //   { _id: tenantId, realmId: realmId },
    //   updateData
    // );
    // return result.modifiedCount || 0;

    const result = await TenantModel.findOneAndUpdate(
      { _id: tenantId, realmId: realmId },
      updateData
    );
    return result as CollectionTypes.Tenant;
  }

  async findByIds(
    tenantIds: string[],
    realmId: string
  ): Promise<CollectionTypes.Tenant[]> {
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      throw new Error('Tenant IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const tenants = await TenantModel.find({
      _id: { $in: tenantIds },
      realmId: realmId
    }).lean();

    return tenants as CollectionTypes.Tenant[];
  }

  async deleteMany(tenantIds: string[], realmId: string): Promise<number> {
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      throw new Error('Tenant IDs must be a non-empty array');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const result = await TenantModel.deleteMany({
      realmId: realmId,
      _id: { $in: tenantIds }
    });

    return result.deletedCount || 0;
  }

  async findWithAggregation(
    realmId: string,
    tenantId?: string
  ): Promise<TenantWithFileDescriptors[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const $match: any = { realmId };
    if (tenantId) {
      $match._id = new ObjectId(tenantId);
    }

    const tenants = await TenantModel.aggregate<TenantWithFileDescriptors>([
      { $match },
      {
        $lookup: {
          from: 'templates',
          let: {
            tenant_realmId: '$realmId',
            tenant_tenantId: { $toString: '$_id' },
            tenant_leaseId: '$leaseId'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$realmId', '$tenant_realmId'] },
                    { $in: ['$tenant_leaseId', '$linkedResourceIds'] },
                    { $eq: ['$type', 'fileDescriptor'] }
                  ]
                }
              }
            },
            {
              $lookup: {
                from: 'documents',
                let: { template_templateId: { $toString: '$_id' } },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$realmId', '$tenant_realmId'] },
                          { $eq: ['$tenantId', '$tenant_tenantId'] },
                          { $eq: ['$leaseId', '$tenant_leaseId'] },
                          { $eq: ['$type', 'file'] },
                          { $eq: ['$templateId', '$template_templateId'] }
                        ]
                      }
                    }
                  },
                  {
                    $project: {
                      realmId: 0,
                      leaseId: 0,
                      tenantId: 0,
                      type: 0,
                      mimeType: 0,
                      templateId: 0,
                      url: 0
                    }
                  }
                ],
                as: 'documents'
              }
            },
            {
              $project: {
                realmId: 0,
                linkedResourceIds: 0,
                type: 0,
                hasExpiryDate: 0
              }
            }
          ],
          as: 'filesToUpload'
        }
      },
      { $sort: { name: 1 } }
    ]);

    await TenantModel.populate(tenants, [
      { path: 'leaseId' },
      { path: 'properties.propertyId' }
    ]);

    return tenants;
  }

  async findAllByYear(realmId: string, year: number): Promise<any[]> {
    return TenantModel.aggregate([
      {
        $match: {
          realmId,
          'rents.year': year
        }
      },
      {
        $addFields: {
          nameLowerCase: { $toLower: '$name' },
          properties: {
            $map: {
              input: '$properties',
              as: 'p',
              in: {
                _id: '$p.property._id',
                type: '$p.property.type',
                name: '$p.property.name'
              }
            }
          },
          rents: {
            $map: {
              input: '$rents',
              as: 'rent',
              in: {
                year: '$rent.year',
                month: '$rent.month',
                payments: '$rent.payments',
                total: '$rent.total'
              }
            }
          }
        }
      },
      {
        $addFields: {
          incoming: {
            $and: [
              { $gte: ['$beginDate', new Date(`${year}-01-01T00:00:00`)] },
              { $lt: ['$beginDate', new Date(`${year + 1}-01-01T00:00:00`)] }
            ]
          },
          outgoing: {
            $or: [
              {
                $and: [
                  {
                    $gte: [
                      '$terminationDate',
                      new Date(`${year}-01-01T00:00:00`)
                    ]
                  },
                  {
                    $lt: [
                      '$terminationDate',
                      new Date(`${year + 1}-01-01T00:00:00`)
                    ]
                  }
                ]
              },
              {
                $and: [
                  { $gte: ['$endDate', new Date(`${year}-01-01T00:00:00`)] },
                  { $lt: ['$endDate', new Date(`${year + 1}-01-01T00:00:00`)] }
                ]
              }
            ]
          }
        }
      },
      {
        $sort: {
          nameLowerCase: 1
        }
      },
      {
        $project: {
          realmId: 1,
          _id: 1,
          name: 1,
          incoming: 1,
          outgoing: 1,
          reference: 1,
          beginDate: 1,
          endDate: 1,
          terminationDate: 1,
          guaranty: 1,
          guarantyPayback: 1,
          properties: 1,
          rents: {
            $filter: {
              input: '$rents',
              as: 'rent',
              cond: {
                $eq: ['$rent.year', year]
              }
            }
          }
        }
      }
    ]);
  }

  async findAll(realmId: string): Promise<CollectionTypes.Tenant[]> {
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const tenants = await TenantModel.find({ realmId }).lean();
    return tenants as CollectionTypes.Tenant[];
  }

  async findByIdWithProperties(
    tenantId: string,
    realmId: string
  ): Promise<CollectionTypes.Tenant | null> {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('Tenant ID must be a non-empty string');
    }
    if (!realmId || typeof realmId !== 'string') {
      throw new Error('Realm ID must be a non-empty string');
    }

    const tenant = await TenantModel.findOne({
      _id: tenantId,
      realmId: realmId
    })
      .populate('properties.propertyId')
      .lean();

    return tenant as CollectionTypes.Tenant | null;
  }

  async findByIdWithAllReferences(
    tenantId: string
  ): Promise<CollectionTypes.Tenant | null> {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('Tenant ID must be a non-empty string');
    }

    const tenant = await TenantModel.findOne({ _id: tenantId })
      .populate('realmId')
      .populate('leaseId')
      .populate('properties.propertyId')
      .lean();

    return tenant as CollectionTypes.Tenant | null;
  }
}
