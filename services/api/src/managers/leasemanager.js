import { DataAccess, logger, ServiceError } from '@microrealestate/common';

////////////////////////////////////////////////////////////////////////////////
// Exported functions
////////////////////////////////////////////////////////////////////////////////
export async function add(req, res) {
  const lease = req.body;
  if (!lease.name) {
    logger.error('missing lease name');
    throw new ServiceError('missing fields', 422);
  }

  const realm = req.realm;
  const leaseRepository = DataAccess.getLeaseRepository();
  
  // Calculate active status based on numberOfTerms and timeRange
  const active = !!lease.active && !!lease.numberOfTerms && !!lease.timeRange;
  
  // Create lease using repository
  const savedLease = await leaseRepository.create({
    ...lease,
    active,
    realmId: realm._id
  });
  
  // Enrich with usedByTenants field
  const setOfUsedLeases = await leaseRepository.findLeaseIdsUsedByTenants(realm._id);
  savedLease.usedByTenants = setOfUsedLeases.has(savedLease._id.toString());
  
  res.json(savedLease);
}

export async function update(req, res) {
  const realm = req.realm;
  const lease = req.body;

  if (!lease.name) {
    logger.error('missing lease name');
    throw new ServiceError('missing fields', 422);
  }

  // Recalculate active status if not explicitly provided
  if (lease.active === undefined) {
    lease.active = lease.numberOfTerms > 0 && !!lease.timeRange;
  }

  const leaseRepository = DataAccess.getLeaseRepository();
  const setOfUsedLeases = await leaseRepository.findLeaseIdsUsedByTenants(realm._id);

  // Determine update data based on whether lease is used by tenants
  const updateData = setOfUsedLeases.has(lease._id)
    ? {
        // If lease already used by tenants, only allow to update name, description, active, stepperMode fields
        name: lease.name,
        description: lease.description,
        active: lease.active,
        stepperMode: lease.stepperMode
      }
    : lease;

  const dbLease = await leaseRepository.update(
    lease._id,
    realm._id,
    updateData
  );

  if (!dbLease) {
    throw new ServiceError('lease not found', 404);
  }

  // Enrich with usedByTenants field
  dbLease.usedByTenants = setOfUsedLeases.has(dbLease._id.toString());
  res.json(dbLease);
}

export async function remove(req, res) {
  const realm = req.realm;
  const leaseIds = req.params.ids.split(',') || [];

  if (!leaseIds.length) {
    logger.error('missing lease ids');
    throw new ServiceError('missing fields', 422);
  }

  const leaseRepository = DataAccess.getLeaseRepository();
  const templateRepository = DataAccess.getTemplateRepository();

  // Check if leases are used by tenants
  const setOfUsedLeases = await leaseRepository.findLeaseIdsUsedByTenants(realm._id);
  if (leaseIds.some((leaseId) => setOfUsedLeases.has(leaseId))) {
    logger.error('lease used by tenants and cannot be removed');
    throw new ServiceError('missing fields', 422);
  }

  // Verify leases exist
  const leases = await leaseRepository.findByIds(leaseIds, realm._id);

  if (!leases.length) {
    throw new ServiceError('lease not found', 404);
  }

  // Find templates linked to these leases
  const templates = await templateRepository.findByLinkedResources(leaseIds, realm._id);

  // Identify orphaned templates (linked only to the leases being deleted)
  const templateIdsToRemove = templates
    .filter(({ linkedResourceIds }) => linkedResourceIds.length <= 1)
    .reduce((acc, { _id }) => [...acc, _id], []);

  // Execute deletion within a transaction
  const sessionManager = DataAccess.getSessionManager();
  try {
    await sessionManager.withTransaction(async (session) => {
      await Promise.all([
        leaseRepository.deleteMany(leaseIds, realm._id, session),
        templateIdsToRemove.length > 0 
          ? templateRepository.deleteMany(templateIdsToRemove, realm._id, session)
          : Promise.resolve(0),
        templateRepository.updateMany(
          {
            realmId: realm._id,
            linkedResourceIds: { $in: leaseIds }
          },
          {
            // remove leaseIds from linkedResourceIds
            $pull: { linkedResourceIds: { $in: leaseIds } }
          },
          session
        )
      ]);
    });
  } catch (error) {
    throw new ServiceError(error, 500);
  }
  res.sendStatus(200);
}

export async function all(req, res) {
  const realm = req.realm;
  const leaseRepository = DataAccess.getLeaseRepository();
  
  const setOfUsedLeases = await leaseRepository.findLeaseIdsUsedByTenants(realm._id);
  const dbLeases = await leaseRepository.findAll(realm._id);

  res.json(
    dbLeases.map((dbLease) => ({
      ...dbLease,
      usedByTenants: setOfUsedLeases.has(dbLease._id.toString())
    }))
  );
}

export async function one(req, res) {
  const realm = req.realm;
  const leaseId = req.params.id;

  const leaseRepository = DataAccess.getLeaseRepository();
  const dbLease = await leaseRepository.findById(leaseId, realm._id);

  if (!dbLease) {
    throw new ServiceError('lease not found', 404);
  }

  const setOfUsedLeases = await leaseRepository.findLeaseIdsUsedByTenants(realm._id);
  dbLease.usedByTenants = setOfUsedLeases.has(dbLease._id.toString());
  res.json(dbLease);
}
