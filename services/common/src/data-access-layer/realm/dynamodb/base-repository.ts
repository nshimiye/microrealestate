import * as bcrypt from 'bcrypt';
import { CollectionTypes } from '@microrealestate/types';
import { BaseRepository } from '../../dynamo/base.js';
import logger from '../../../utils/logger.js';
import { BaseRealmCRUDRepository } from '../../dynamo/base-realm-crud.js';

/**
 * Repository for Realm entities.
 * Handles organization/tenant management with nested structures.
 */
export abstract class RealmBaseRepository extends BaseRealmCRUDRepository<CollectionTypes.Realm> {
  /**
   * Build partition key for Realm entity.
   * Format: REALM#<realmId>
   *
   * @param realmId The realm identifier
   * @returns The partition key
   */
  protected buildPK(realmId: string): string {
    return `REALM#${realmId}`;
  }

  /**
   * Build sort key for Realm entity.
   * Format: REALM#<realmId>
   *
   * @param realmId The realm identifier
   * @returns The sort key
   */
  protected buildSK(realmId: string): string {
    return `REALM#${realmId}`;
  }

  /**
   * Transform Realm entity to DynamoDB item.
   * Preserves all nested structures (members, applications, addresses, etc.)
   *
   * @param entity The Realm entity
   * @returns The DynamoDB item
   */
  protected toItem(entity: CollectionTypes.Realm): Record<string, any> {
    const realmId = entity._id;

    // Convert Date objects in applications to ISO strings
    const applications = (entity.applications || []).map((app) => ({
      ...app,
      createdDate: app.createdDate ? app.createdDate.toISOString() : undefined,
      expiryDate: app.expiryDate ? app.expiryDate.toISOString() : undefined
    }));

    return {
      PK: this.buildPK(realmId),
      SK: this.buildSK(realmId),
      EntityType: 'Realm',
      RealmId: realmId,
      Name: entity.name,
      // Preserve nested structures
      Members: entity.members || [],
      Applications: applications,
      Addresses: entity.addresses || [],
      BankInfo: entity.bankInfo || {},
      Contacts: entity.contacts || [],
      IsCompany: entity.isCompany || false,
      CompanyInfo: entity.companyInfo || {},
      ThirdParties: entity.thirdParties || {},
      Locale: entity.locale || 'en',
      Currency: entity.currency || 'USD'
    };
  }

  /**
   * Transform DynamoDB item to Realm entity.
   * Restores all nested structures from DynamoDB format.
   *
   * @param item The DynamoDB item
   * @returns The Realm entity
   */
  protected fromItem(item: Record<string, any>): CollectionTypes.Realm {
    // Convert ISO strings back to Date objects in applications
    const applications = (item.Applications || []).map((app: any) => ({
      ...app,
      createdDate: app.createdDate ? new Date(app.createdDate) : undefined,
      expiryDate: app.expiryDate ? new Date(app.expiryDate) : undefined
    }));

    return {
      _id: item.RealmId,
      name: item.Name,
      members: item.Members || [],
      applications,
      addresses: item.Addresses || [],
      bankInfo: item.BankInfo || {},
      contacts: item.Contacts || [],
      isCompany: item.IsCompany || false,
      companyInfo: item.CompanyInfo || {},
      thirdParties: item.ThirdParties || {},
      locale: item.Locale || 'en',
      currency: item.Currency || 'USD'
    };
  }

  /**
   * Create a new realm with application secret hashing.
   * Overrides base create to add application secret hashing logic.
   *
   * @param entity The realm to create
   * @returns The created realm
   * @throws ServiceError if creation fails
   */
  async create(entity: CollectionTypes.Realm): Promise<CollectionTypes.Realm> {
    try {
      // Hash application secrets before storing
      const realmWithHashedSecrets = { ...entity };

        realmWithHashedSecrets.applications =
          (realmWithHashedSecrets.applications||[]).map((app) => {
            // Only hash if this is a new application (no createdDate)
            if (!app.createdDate) {
              return {
                ...app,
                createdDate: new Date(),
                clientSecret: bcrypt.hashSync(app.clientSecret, 10)
              };
            }
            return app;
          });

      const item = this.toItem(realmWithHashedSecrets);

      // Validate item size before attempting to write
      this.validateItemSize(item);

      await this.client.putItem(item);

      logger.debug('Realm created successfully', {
        realmId: realmWithHashedSecrets._id
      });

      return realmWithHashedSecrets;
    } catch (error) {
      logger.error('Failed to create realm', { error });
      throw error;
    }
  }

  /**
   * Update a realm.
   * Overrides base method to handle application secret hashing.
   *
   * @param realmId The realm identifier
   * @param updates Partial realm updates
   * @returns The updated realm
   */
  async update(
    id: string,
    updates: Partial<CollectionTypes.Realm>
  ): Promise<CollectionTypes.Realm | null> {
    // If applications are being updated, hash any new secrets
    if (updates.applications) {
      updates.applications = updates.applications.map((app) => {
        // Only hash if this is a new application (no createdDate)
        if (!app.createdDate) {
          return {
            ...app,
            createdDate: new Date(),
            clientSecret: bcrypt.hashSync(app.clientSecret, 10)
          };
        }
        return app;
      });
    }

    return super.update(id, updates);
  }

  /**
   * Find realm by ID.
   * Overrides base method for clarity.
   *
   * @param realmId The realm identifier
   * @returns The realm if found, null otherwise
   */
  async findById(realmId: string): Promise<CollectionTypes.Realm | null> {
    return super.findById(realmId);
  }

  /**
   * Delete a realm.
   * Overrides base method for clarity.
   *
   * @param realmId The realm identifier
   */
  async delete(realmId: string): Promise<void> {
    return super.delete(realmId);
  }
}

export default RealmBaseRepository;
