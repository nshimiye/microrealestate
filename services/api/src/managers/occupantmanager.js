import * as Contract from './contract.js';
import * as FD from './frontdata.js';
import {
  DataAccess,
  logger,
  Service,
  ServiceError
} from '@microrealestate/common';
import axios from 'axios';
import { customAlphabet } from 'nanoid';
import moment from 'moment';

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 12);

function _stringToDate(dateString) {
  return dateString ? moment(dateString, 'DD/MM/YYYY').toDate() : undefined;
}

function _formatTenant(tenant) {
  const formattedTenant = {
    ...tenant,
    beginDate: _stringToDate(tenant.beginDate),
    endDate: _stringToDate(tenant.endDate),
    terminationDate: _stringToDate(tenant.terminationDate),
    properties: tenant.properties?.map((property) => ({
      ...property,
      entryDate:
        _stringToDate(property.entryDate) || _stringToDate(tenant.beginDate),
      exitDate:
        _stringToDate(property.exitDate) || _stringToDate(tenant.endDate),
      expenses: property.expenses?.map((expense) => ({
        ...expense,
        beginDate: _stringToDate(expense.beginDate),
        endDate: _stringToDate(expense.endDate)
      }))
    })),
    reference: tenant.reference || nanoid()
  };

  if (!formattedTenant.isCompany) {
    formattedTenant.company = null;
    formattedTenant.legalForm = null;
    formattedTenant.siret = null;
    formattedTenant.capital = null;
    formattedTenant.name = formattedTenant.name || formattedTenant.manager;
  } else {
    formattedTenant.name = formattedTenant.company;
  }

  return formattedTenant;
}

async function _buildPropertyMap(realm) {
  const propertyRepository = DataAccess.getPropertyRepository();
  const properties = await propertyRepository.findAll(realm._id);

  return properties.reduce((acc, property) => {
    property._id = String(property._id);
    acc[property._id] = property;
    return acc;
  }, {});
}

async function _fetchTenants(realmId, tenantId) {
  const tenantRepository = DataAccess.getTenantRepository();
  
  // Use repository method instead of direct aggregation
  const tenants = await tenantRepository.findWithAggregation(realmId, tenantId);

  // Compute the missing document flags (business logic remains in occupant manager)
  const now = moment();
  tenants.forEach((tenant) =>
    tenant.filesToUpload?.forEach((fileToUpload) => {
      const { required, requiredOnceContractTerminated, documents } =
        fileToUpload;
      fileToUpload.missing =
        (required || (requiredOnceContractTerminated && tenant.terminated)) &&
        (!documents.length ||
          !documents.some(({ expiryDate }) =>
            expiryDate ? moment(expiryDate).isSameOrAfter(now) : true
          ));
    })
  );

  return tenants;
}

function _propertiesHaveRentData(properties) {
  return (
    properties?.length &&
    properties.every(
      ({ rent, entryDate, exitDate }) => rent && entryDate && exitDate
    )
  );
}

////////////////////////////////////////////////////////////////////////////////
// Exported functions
////////////////////////////////////////////////////////////////////////////////
export async function add(req, res) {
  const realm = req.realm;
  const { _id, ...occupant } = _formatTenant(req.body);

  if (!occupant.name) {
    logger.error('missing tenant name');
    throw new ServiceError('missing fields', 422);
  }

  const propertyMap = await _buildPropertyMap(realm);

  // Resolve proprerties
  occupant.properties?.forEach((property) => {
    property.property = propertyMap[property.propertyId];
    property.rent = property.rent || property.property.price;
    property.expenses =
      property.expenses ||
      (property.property.expense && [
        { title: 'general expense', amount: property.property.expense }
      ]) ||
      [];
  });

  // Build rents from contract
  try {
    occupant.rents = [];
    if (
      occupant.beginDate &&
      occupant.endDate &&
      _propertiesHaveRentData(occupant.properties)
    ) {
      const contract = Contract.create({
        begin: occupant.beginDate,
        end: occupant.endDate,
        frequency: occupant.frequency || 'months',
        properties: occupant.properties
      });

      occupant.rents = contract.rents;
    }
  } catch (error) {
    throw new ServiceError(error, 409);
  }

  // Use repository instead of direct Mongoose model
  const tenantRepository = DataAccess.getTenantRepository();
  const newOccupant = await tenantRepository.create({
    ...occupant,
    realmId: realm._id
  });

  const occupants = await _fetchTenants(req.realm._id, newOccupant._id);
  res.json(FD.toOccupantData(occupants.length ? occupants[0] : null));
}

export async function update(req, res) {
  const realm = req.realm;
  const occupantId = req.params.id;
  const newOccupant = _formatTenant(req.body);

  if (!newOccupant.name) {
    logger.error('missing tenant name');
    throw new ServiceError('missing fields', 422);
  }

  // Use repository instead of direct Mongoose model
  const tenantRepository = DataAccess.getTenantRepository();
  const originalOccupant = await tenantRepository.findOne({
    tenantId: occupantId,
    realmId: realm._id
  });

  if (!originalOccupant) {
    throw new ServiceError('tenant not found', 404);
  }

  if (originalOccupant.documents) {
    newOccupant.documents = originalOccupant.documents;
  }

  const propertyMap = await _buildPropertyMap(realm);

  newOccupant.properties = newOccupant.properties.map((rentedProperty) => {
    // Merge properties from originalOccupant to newOccupant
    // copy property from db if not present in originalOccupant
    if (!rentedProperty.property) {
      const orignalProperty = originalOccupant.properties?.find(
        ({ propertyId }) => propertyId === rentedProperty.propertyId
      );

      rentedProperty.property =
        orignalProperty?.property || propertyMap[rentedProperty.propertyId];
    }

    return rentedProperty;
  });

  // Build rents from contract
  if (
    newOccupant.beginDate &&
    newOccupant.endDate &&
    _propertiesHaveRentData(newOccupant.properties)
  ) {
    try {
      const termFrequency = newOccupant.frequency || 'months';

      const contract = {
        begin: originalOccupant.beginDate,
        end: originalOccupant.endDate,
        frequency: termFrequency,
        terms: Math.ceil(
          moment(originalOccupant.endDate).diff(
            moment(originalOccupant.beginDate),
            termFrequency,
            true
          )
        ),
        properties: originalOccupant.properties,
        vatRate: originalOccupant.vatRatio,
        discount: originalOccupant.discount,
        rents: originalOccupant.rents
      };

      const modification = {
        begin: newOccupant.beginDate,
        end: newOccupant.endDate,
        termination: newOccupant.terminationDate,
        properties: newOccupant.properties,
        frequency: termFrequency
      };
      if (newOccupant.vatRatio !== undefined) {
        modification.vatRate = newOccupant.vatRatio;
      }
      if (newOccupant.discount !== undefined) {
        modification.discount = newOccupant.discount;
      }

      const newContract = Contract.update(contract, modification);
      newOccupant.rents = newContract.rents;
    } catch (e) {
      throw new ServiceError(e, 409);
    }
  } else {
    const paidRents =
      newOccupant.rents?.some(
        (rent) =>
          (rent.payments &&
            rent.payments.some((payment) => payment.amount > 0)) ||
          rent.discounts.some((discount) => discount.origin === 'settlement')
      ) || [];

    if (paidRents.length) {
      throw new ServiceError(
        'impossible to update tenant some rents have been paid',
        409
      );
    }
    newOccupant.rents = [];
  }

  // Use repository instead of direct Mongoose model
  await tenantRepository.update(occupantId, realm._id, newOccupant);

  const newOccupants = await _fetchTenants(req.realm._id, occupantId);
  res.json(FD.toOccupantData(newOccupants.length ? newOccupants[0] : null));
}

export async function remove(req, res) {
  const realm = req.realm;
  const occupantIds = req.params?.ids.split(',') || [];

  if (!occupantIds.length) {
    throw new ServiceError('tenant not found', 404);
  }

  // Use repository instead of direct Mongoose model
  const tenantRepository = DataAccess.getTenantRepository();
  const occupants = await tenantRepository.findByIds(occupantIds, realm._id);

  if (!occupants.length) {
    throw new ServiceError('tenant not found', 404);
  }

  // Keep validation logic for paid rents
  const occupantsWithPaidRents = occupants.filter((occupant) => {
    return occupant.rents.some(
      (rent) =>
        (rent.payments &&
          rent.payments.some((payment) => payment.amount > 0)) ||
        rent.discounts.some((discount) => discount.origin === 'settlement')
    );
  });

  if (occupantsWithPaidRents.length) {
    throw new ServiceError(
      `impossible to remove ${occupantsWithPaidRents[0].name} some rents have been paid`,
      409
    );
  }

  // Use SessionManager for transaction management
  const sessionManager = DataAccess.getSessionManager();
  try {
    // eslint-disable-next-line no-unused-vars
    await sessionManager.withTransaction(async (session) => {
      // Use repository to find documents
      const documentRepository = DataAccess.getDocumentRepository();
      const documents = await documentRepository.findByTenantIds(
        occupantIds,
        realm._id,
        { _id: 1 }
      );

      // Keep PDF generator service call via axios
      const { PDFGENERATOR_URL } = Service.getInstance().envConfig.getValues();
      const documentsEndPoint = `${PDFGENERATOR_URL}/documents/${documents
        .map(({ _id }) => _id)
        .join(',')}`;
      try {
        await axios.delete(documentsEndPoint, {
          headers: {
            authorization: req.headers.authorization,
            organizationid: req.headers.organizationid || String(req.realm._id),
            'Accept-Language': req.headers['accept-language']
          }
        });
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        logger.error('DELETE documents failed');
        logger.error(errorMessage);
      }

      // Use repository to delete tenants
      await tenantRepository.deleteMany(occupantIds, realm._id);
    });
  } catch (error) {
    throw new ServiceError(error, 500);
  }
  
  res.sendStatus(200);
}

export async function all(req, res) {
  const tenants = await _fetchTenants(req.realm._id);
  res.json(tenants.map((tenant) => FD.toOccupantData(tenant)));
}

export async function one(req, res) {
  const occupantId = req.params.id;
  const tenants = await _fetchTenants(req.realm._id, occupantId);
  res.json(tenants.length ? FD.toOccupantData(tenants[0]) : null);
}

export async function overview(req, res) {
  const realm = req.realm;
  const currentDate = moment();

  // Use repository instead of direct Mongoose model
  const tenantRepository = DataAccess.getTenantRepository();
  const occupants = await tenantRepository.findAll(realm._id);

  let result = {
    countAll: occupants?.length || 0,
    countActive: 0,
    countInactive: 0
  };

  result = occupants.reduce((acc, occupant) => {
    const endMoment = moment(occupant.terminationDate || occupant.endDate);
    if (endMoment.isBefore(currentDate, 'day')) {
      acc.countInactive++;
    } else {
      acc.countActive++;
    }
    return acc;
  }, result);

  res.json(result);
}
