import { CollectionTypes } from '@microrealestate/types';
import { BaseRepository } from '../../dynamo/base.js';
/**
 * Repository for Lease entities.
 * Handles lease contract management within realms.
 */
export abstract class LeaseBaseRepository extends BaseRepository<CollectionTypes.Lease> {

  /**
   * Build partition key for Lease entity.
   * Format: REALM#<realmId>
   *
   * @param leaseId The lease identifier (not used for PK)
   * @param realmId The realm identifier
   * @returns The partition key
   */
  protected buildPK(leaseId: string, realmId?: string): string {
    if (!realmId) {
      throw new Error('realmId is required for Lease entities');
    }
    return `REALM#${realmId}`;
  }

  /**
   * Build sort key for Lease entity.
   * Format: LEASE#<leaseId>
   *
   * @param leaseId The lease identifier
   * @returns The sort key
   */
  protected buildSK(leaseId: string): string {
    return `LEASE#${leaseId}`;
  }

  /**
   * Transform Lease entity to DynamoDB item.
   * Preserves all fields including name, numberOfTerms, timeRange, and active status.
   *
   * @param entity The Lease entity
   * @returns The DynamoDB item
   */
  protected toItem(entity: CollectionTypes.Lease): Record<string, any> {
    const leaseId = entity._id;
    const realmId =
      typeof entity.realmId === 'string' ? entity.realmId : entity.realmId;

    return {
      PK: this.buildPK(leaseId, realmId),
      SK: this.buildSK(leaseId),
      EntityType: 'Lease',
      RealmId: realmId,
      LeaseId: leaseId,
      Name: entity.name,
      Description: entity.description,
      NumberOfTerms: entity.numberOfTerms,
      TimeRange: entity.timeRange,
      Active: entity.active,
      StepperMode: entity.stepperMode || false,
    };
  }

  /**
   * Transform DynamoDB item to Lease entity.
   * Restores all fields from DynamoDB format.
   *
   * @param item The DynamoDB item
   * @returns The Lease entity
   */
  protected fromItem(item: Record<string, any>): CollectionTypes.Lease {
    return {
      _id: item.LeaseId,
      realmId: item.RealmId,
      name: item.Name,
      description: item.Description,
      numberOfTerms: item.NumberOfTerms,
      timeRange: item.TimeRange,
      active: item.Active,
      stepperMode: item.StepperMode || false,
    };
  }

  /**
   * Find all leases for a given realm.
   * Uses the base repository's findByRealm method with LEASE# prefix.
   *
   * @param realmId The realm identifier
   * @returns Array of leases in the realm
   * @throws ServiceError if query fails
   */
  async findByRealm(realmId: string): Promise<CollectionTypes.Lease[]> {
    return super.findByRealm(realmId, 'LEASE#');
  }

  /**
   * Create a new lease.
   * Overrides base method for clarity and validation.
   *
   * @param entity The lease to create
   * @returns The created lease
   * @throws ServiceError if creation fails or realmId is missing
   */
  async create(entity: CollectionTypes.Lease): Promise<CollectionTypes.Lease> {
    const realmId =
      typeof entity.realmId === 'string' ? entity.realmId : entity.realmId;

    if (!realmId) {
      throw new Error('realmId is required to create a Lease');
    }

    return super.create(entity);
  }

  /**
   * Find lease by ID.
   * Requires realmId for partition key construction.
   *
   * @param leaseId The lease identifier
   * @param realmId The realm identifier
   * @returns The lease if found, null otherwise
   * @throws Error if realmId is not provided
   */
  async findById(
    leaseId: string,
    realmId?: string
  ): Promise<CollectionTypes.Lease | null> {
    if (!realmId) {
      throw new Error('realmId is required to find a Lease by ID');
    }
    return super.findById(leaseId, realmId);
  }

  /**
   * Update a lease.
   * Requires realmId for partition key construction.
   *
   * @param leaseId The lease identifier
   * @param updates Partial lease updates
   * @param realmId The realm identifier
   * @returns The updated lease
   * @throws Error if realmId is not provided
   */
  async update(
    // leaseId: string,
    // updates: Partial<CollectionTypes.Lease>,
    // realmId?: string
    leaseId: string,
    realmId: string,
    updates: Partial<CollectionTypes.Lease>
  ): Promise<CollectionTypes.Lease|null> {
    if (!realmId) {
      throw new Error('realmId is required to update a Lease');
    }
    return super.update(leaseId, realmId, updates);
  }

  /**
   * Delete a lease.
   * Requires realmId for partition key construction.
   *
   * @param leaseId The lease identifier
   * @param realmId The realm identifier
   * @throws Error if realmId is not provided
   */
  async delete(leaseId: string, realmId?: string): Promise<void> {
    if (!realmId) {
      throw new Error('realmId is required to delete a Lease');
    }
    return super.delete(leaseId, realmId);
  }
}

export default LeaseBaseRepository;
