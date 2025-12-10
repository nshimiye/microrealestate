import { DataAccess, logger, Service } from '@microrealestate/common';
import axios from 'axios';
import moment from 'moment';

async function _sendEmail(req, message) {
  const { EMAILER_URL } = Service.getInstance().envConfig.getValues();
  const postData = {
    templateName: message.document,
    recordId: message.tenantId,
    params: {
      term: message.term
    }
  };

  try {
    const response = await axios.post(EMAILER_URL, postData, {
      headers: {
        authorization: req.headers.authorization,
        organizationid: req.headers.organizationid || String(req.realm._id),
        'Accept-Language': req.headers['accept-language']
      }
    });

    logger.debug(`data sent: ${JSON.stringify(postData)}`);
    logger.debug(`response: ${JSON.stringify(response.data)}`);

    return response.data.map(
      ({ templateName, recordId, params, email, status /*, error*/ }) => ({
        document: templateName,
        tenantId: recordId,
        term: params.term,
        email,
        status
      })
    );
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    logger.error(`POST ${EMAILER_URL} failed`);
    logger.error(`data sent: ${JSON.stringify(postData)}`);
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
}

export async function send(req, res) {
  const realm = req.realm;
  const { document, tenantIds, terms, year, month } = req.body;
  const defaultTerm = moment(`${year}/${month}/01`, 'YYYY/MM/DD').format(
    'YYYYMMDDHH'
  );

  // Handle empty tenant list
  if (!tenantIds || tenantIds.length === 0) {
    return res.json([]);
  }

  const tenantRepository = DataAccess.getTenantRepository();
  const tenants = await tenantRepository.findByIds(tenantIds, String(realm._id));

  const statusList = await Promise.all(
    tenants.map(async (tenant, index) => {
      const tenantId = String(tenant._id);
      const term = Number((terms && terms[index]) || defaultTerm);

      // Send email to tenant
      try {
        const statusArray = await _sendEmail(req, {
          name: tenant.name,
          tenantId,
          document,
          term
        });
        const status = statusArray[0] || {};
        return {
          name: tenant.name,
          tenantId,
          document,
          term,
          email: status.email,
          status: status.status
        };
      } catch (error) {
        logger.error(error);
        return {
          name: tenant.name,
          tenantId,
          document,
          term,
          error: error.response?.data || {
            status: 500,
            message: `Something went wrong when sending the email to ${tenant.name}`
          }
        };
      }
    })
  );

  if (statusList.some((status) => !!status.error)) {
    res.status(500).json(statusList);
  } else {
    res.json(statusList);
  }
}
