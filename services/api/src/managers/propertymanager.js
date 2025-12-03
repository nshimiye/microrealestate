import * as FD from './frontdata.js';
import { DataAccess } from '@microrealestate/common';

// Get repository instances
const propertyRepository = DataAccess.getPropertyRepository();
const tenantRepository = DataAccess.getTenantRepository();

async function _toPropertiesData(realm, inputProperties) {
  const allTenants = await tenantRepository.findByPropertyIds(
    inputProperties.map(({ _id }) => _id),
    realm._id
  );

  return inputProperties.map((property) => {
    const tenants = allTenants
      .filter(({ properties }) =>
        properties
          .map(({ propertyId }) => propertyId)
          .includes(String(property._id))
      )
      .sort((t1, t2) => {
        const t1EndDate = t1.terminationDate || t1.endDate;
        const t2EndDate = t2.terminationDate || t2.endDate;
        return t2EndDate - t1EndDate;
      });
    return FD.toProperty(property, tenants?.[0], tenants);
  });
}

////////////////////////////////////////////////////////////////////////////////
// Exported functions
////////////////////////////////////////////////////////////////////////////////
export async function add(req, res) {
  const realm = req.realm;
  const property = await propertyRepository.create({
    ...req.body,
    realmId: realm._id
  });
  const properties = await _toPropertiesData(realm, [property]);
  return res.json(properties[0]);
}

export async function update(req, res) {
  const realm = req.realm;
  const property = req.body;

  const dbProperty = await propertyRepository.update(
    property._id,
    realm._id,
    property
  );

  const properties = await _toPropertiesData(realm, [dbProperty]);
  return res.json(properties[0]);
}

export async function remove(req, res) {
  const realm = req.realm;
  const ids = req.params.ids.split(',');

  await propertyRepository.delete(ids, realm._id);

  res.sendStatus(200); // better to return 204
}

export async function all(req, res) {
  const realm = req.realm;

  const dbProperties = await propertyRepository.findAll(realm._id);

  const properties = await _toPropertiesData(realm, dbProperties);
  return res.json(properties);
}

export async function one(req, res) {
  const realm = req.realm;
  const tenantId = req.params.id;

  const dbProperty = await propertyRepository.findById(
    tenantId,
    realm._id
  );

  const properties = await _toPropertiesData(realm, [dbProperty]);
  return res.json(properties[0]);
}
