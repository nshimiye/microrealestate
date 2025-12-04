import * as pdf from '../pdf.js';
import * as s3 from '../utils/s3.js';
import {
  DataAccess,
  Format,
  logger,
  Middlewares,
  Service,
  ServiceError
} from '@microrealestate/common';
import express from 'express';
import fs from 'fs-extra';
import Handlebars from 'handlebars';
import moment from 'moment';
import path from 'path';
import uploadMiddleware from '../utils/uploadmiddelware.js';

/**
 * Fetch template by ID and realm
 * @private
 * @param {Object} organization - Organization/realm object
 * @param {string} templateId - Template ID
 * @returns {Promise<Object|null>} Template object or null if not found
 */
async function _getTemplate(organization, templateId) {
  const templateRepository = DataAccess.getTemplateRepository();
  return await templateRepository.findById(templateId, String(organization._id));
}

/**
 * Fetch and compute template values from tenant, lease, and properties
 * @private
 * @param {Object} organization - Organization/realm object
 * @param {string} tenantId - Tenant ID
 * @param {string} leaseId - Lease ID
 * @returns {Promise<Object>} Template values object for document generation
 */
async function _getTemplateValues(organization, tenantId, leaseId) {
  const tenantRepository = DataAccess.getTenantRepository();
  const leaseRepository = DataAccess.getLeaseRepository();

  // Fetch tenant with populated properties
  const tenant = await tenantRepository.findByIdWithProperties(
    tenantId,
    String(organization._id)
  );

  // Fetch lease
  const lease = await leaseRepository.findById(leaseId, String(organization._id));

  // compute rent, expenses and surface from properties
  const PropertyGlobals = tenant.properties.reduce(
    (acc, { rent, expenses = [], propertyId: { surface } }) => {
      acc.rentAmount += rent;
      acc.expensesAmount +=
        expenses.reduce((sum, { amount }) => {
          sum += amount;
          return sum;
        }, 0) || 0;
      acc.surface += surface;
      return acc;
    },
    { rentAmount: 0, expensesAmount: 0, vatAmount: 0, surface: 0 }
  );

  // manage legacy discount
  if (tenant.discount) {
    PropertyGlobals.rentAmount -= tenant.discount;
  }

  // manage vat
  if (tenant.isVat && tenant.vatRatio) {
    PropertyGlobals.vatAmount =
      Math.round(
        (PropertyGlobals.rentAmount + PropertyGlobals.expensesAmount) *
          tenant.vatRatio *
          100
      ) / 100;
  }

  const landlordCompanyInfo = organization.companyInfo
    ? {
        ...organization.companyInfo,
        capital: organization.companyInfo.capital
          ? Format.formatCurrency(
              organization.locale,
              organization.currency,
              organization.companyInfo.capital
            )
          : ''
      }
    : null;

  moment.locale(organization.locale);
  const today = moment();
  const templateValues = {
    current: {
      date: today.format('LL'),
      day: today.format('D'),
      month: today.format('MMMM'),
      year: today.format('YYYY'),
      location: organization.addresses?.[0]?.city
    },

    landlord: {
      name: organization.name,
      contact: organization.contacts?.[0] || {},
      address: organization.addresses?.[0] || {},
      companyInfo: landlordCompanyInfo
    },

    tenant: {
      name: tenant?.name,

      companyInfo: {
        legalRepresentative: tenant?.manager,
        legalStructure: tenant?.legalForm,
        capital: tenant?.capital
          ? Format.formatCurrency(
              organization.locale,
              organization.currency,
              tenant.capital
            )
          : '',
        ein: tenant?.siret,
        dos: tenant?.rcs
      },

      address: {
        street1: tenant?.street1,
        street2: tenant?.street2,
        zipCode: tenant?.zipCode,
        city: tenant?.city,
        state: tenant?.state,
        country: tenant?.country
      },

      contacts:
        tenant?.contacts.map(({ contact, email, phone }) => ({
          name: contact,
          email,
          phone
        })) || []
    },

    properties: {
      total: {
        surface: Format.formatNumber(
          organization.locale,
          PropertyGlobals.surface
        ),
        rentAmount: Format.formatCurrency(
          organization.locale,
          organization.currency,
          PropertyGlobals.rentAmount
        ),
        expensesAmount: Format.formatCurrency(
          organization.locale,
          organization.currency,
          PropertyGlobals.expensesAmount
        ),
        allInclusiveRentAmount: Format.formatCurrency(
          organization.locale,
          organization.currency,
          PropertyGlobals.rentAmount + PropertyGlobals.expensesAmount
        ),
        allInclusiveRentWithVATAmount: Format.formatCurrency(
          organization.locale,
          organization.currency,
          PropertyGlobals.rentAmount +
            PropertyGlobals.expensesAmount +
            PropertyGlobals.vatAmount
        )
      },
      list: tenant?.properties.map(
        ({
          propertyId: {
            name,
            description,
            type,
            surface,
            phone,
            address,
            digicode,
            price
          }
        }) => ({
          name,
          description,
          type,
          rent: Format.formatCurrency(
            organization.locale,
            organization.currency,
            price
          ),
          surface: Format.formatNumber(organization.locale, surface),
          phone,
          address,
          digicode
        })
      )
    },

    lease: {
      name: lease?.name,
      description: lease?.description,
      numberOfTerms: lease?.numberOfTerms,
      timeRange: lease?.timeRange,
      beginDate: moment(tenant.beginDate).format('LL'),
      endDate: moment(tenant.endDate).format('LL'),
      deposit: Format.formatCurrency(
        organization.locale,
        organization.currency,
        tenant.guaranty || 0
      )
    }
  };
  return templateValues;
}

function _resolveTemplates(element, templateValues) {
  if (element.content) {
    element.content = element.content.map((childElement) =>
      _resolveTemplates(childElement, templateValues)
    );
  }

  if (element.type === 'template') {
    element.type = 'text';
    element.text = Handlebars.compile(element.attrs.id)(templateValues) || ' '; // empty text node are not allowed in tiptap editor
    // TODO check if this doesn't open XSS issues
    element.text = element.text.replace(/&#x27;/g, "'");
    delete element.attrs;
  }
  return element;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     Document:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique document identifier
 *         realmId:
 *           type: string
 *           description: Organization identifier
 *         tenantId:
 *           type: string
 *           description: Tenant identifier
 *         leaseId:
 *           type: string
 *           description: Lease identifier
 *         templateId:
 *           type: string
 *           description: Template identifier used to generate the document
 *         type:
 *           type: string
 *           enum: [text, file]
 *           description: Document type (text for generated documents, file for uploaded files)
 *         name:
 *           type: string
 *           description: Document name
 *         description:
 *           type: string
 *           description: Document description
 *         contents:
 *           type: object
 *           description: Document contents in TipTap JSON format (for text type)
 *         html:
 *           type: string
 *           description: Document HTML representation (for text type)
 *         mimeType:
 *           type: string
 *           description: MIME type of the file (for file type)
 *         url:
 *           type: string
 *           description: File URL or path (for file type)
 *         versionId:
 *           type: string
 *           description: S3 version ID (for file type)
 *         expiryDate:
 *           type: string
 *           format: date
 *           description: Document expiry date (for file type)
 *     DocumentUploadResponse:
 *       type: object
 *       properties:
 *         fileName:
 *           type: string
 *           description: Uploaded file name
 *         key:
 *           type: string
 *           description: S3 key or file path
 *   responses:
 *     UnauthorizedError:
 *       description: Access token is missing or invalid
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *                 example: Unauthorized
 *     NotFoundError:
 *       description: Resource not found
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *                 example: document not found
 *     ValidationError:
 *       description: Invalid request parameters
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *                 example: missing fields
 *     InternalServerError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *                 example: Internal server error
 */
export default function () {
  const { UPLOADS_DIRECTORY } = Service.getInstance().envConfig.getValues();
  const documentsApi = express.Router();

  /**
   * @openapi
   * /documents/{document}/{id}/{term}:
   *   get:
   *     summary: Generate PDF document for a specific term
   *     description: Generates and downloads a PDF document for a tenant's specific term
   *     tags:
   *       - Documents
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: document
   *         required: true
   *         schema:
   *           type: string
   *         description: Document type (e.g., invoice, contract, notice)
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Tenant or entity identifier
   *       - in: path
   *         name: term
   *         required: true
   *         schema:
   *           type: string
   *         description: Term identifier (e.g., month/year)
   *     responses:
   *       200:
   *         description: PDF file download
   *         content:
   *           application/pdf:
   *             schema:
   *               type: string
   *               format: binary
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  documentsApi.get(
    '/:document/:id/:term',
    Middlewares.asyncWrapper(async (req, res) => {
      try {
        logger.debug(`generate pdf file for ${JSON.stringify(req.params)}`);
        const pdfFile = await pdf.generate(req.params.document, req.params);
        return res.download(pdfFile);
      } catch (error) {
        throw new ServiceError(error, 404);
      }
    })
  );

  /**
   * @openapi
   * /documents:
   *   get:
   *     summary: Get all documents
   *     description: Retrieves all documents for the authenticated organization
   *     tags:
   *       - Documents
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of documents
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Document'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  documentsApi.get(
    '/',
    Middlewares.asyncWrapper(async (req, res) => {
      const organizationId = req.headers.organizationid;

      const documentRepository = DataAccess.getDocumentRepository();
      const documentsFound = await documentRepository.findAll(organizationId);
      if (!documentsFound || documentsFound.length === 0) {
        throw new ServiceError('document not found', 404);
      }

      return res.status(200).json(documentsFound);
    })
  );

  /**
   * @openapi
   * /documents/{id}:
   *   get:
   *     summary: Get document by ID
   *     description: Retrieves a specific document by ID, returns JSON for text documents or file download for file documents
   *     tags:
   *       - Documents
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Document identifier
   *     responses:
   *       200:
   *         description: Document details or file download
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Document'
   *           application/pdf:
   *             schema:
   *               type: string
   *               format: binary
   *           image/*:
   *             schema:
   *               type: string
   *               format: binary
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  documentsApi.get(
    '/:id',
    Middlewares.asyncWrapper(async (req, res) => {
      const documentId = req.params.id;

      if (!documentId) {
        logger.error('missing document id');
        throw new ServiceError('missing fields', 422);
      }

      const documentRepository = DataAccess.getDocumentRepository();
      const documentFound = await documentRepository.findById(
        documentId,
        String(req.realm._id)
      );

      if (!documentFound) {
        logger.warn(`document ${documentId} not found`);
        throw new ServiceError('document not found', 404);
      }

      if (documentFound.type === 'text') {
        return res.status(200).json(documentFound);
      }

      if (documentFound.type === 'file') {
        if (!documentFound?.url) {
          logger.error('document url required');
          throw new ServiceError('missing fields', 422);
        }

        if (documentFound.url.indexOf('..') !== -1) {
          logger.error('document url invalid containing ".."');
          throw new ServiceError('missing fields', 422);
        }

        // first try to download from file system
        const filePath = path.join(UPLOADS_DIRECTORY, documentFound.url);
        if (fs.existsSync(filePath)) {
          try {
            return fs.createReadStream(filePath).pipe(res);
          } catch (error) {
            logger.error(
              `cannot download file ${documentFound.url} from file system`,
              error
            );
            throw new ServiceError('cannot download file', 404);
          }
        }

        // otherwise download from s3
        if (s3.isEnabled(req.realm.thirdParties.b2)) {
          try {
            return s3
              .downloadFile(req.realm.thirdParties.b2, documentFound.url)
              .pipe(res);
          } catch (error) {
            logger.error(
              `cannot download file ${documentFound.url} from s3`,
              error
            );
            throw new ServiceError('cannot download file', 404);
          }
        }
      }

      logger.error(`document ${documentId} not found`);
      throw new ServiceError('document not found', 404);
    })
  );

  /**
   * @openapi
   * /documents/upload:
   *   post:
   *     summary: Upload a document file
   *     description: Uploads a PDF or image file to the system (file system or S3)
   *     tags:
   *       - Documents
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - file
   *               - fileName
   *               - s3Dir
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: File to upload (PDF or image)
   *               fileName:
   *                 type: string
   *                 description: Name for the uploaded file
   *               s3Dir:
   *                 type: string
   *                 description: S3 directory path
   *     responses:
   *       201:
   *         description: File uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/DocumentUploadResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  documentsApi.post(
    '/upload',
    uploadMiddleware(),
    Middlewares.asyncWrapper(async (req, res) => {
      const key = [req.body.s3Dir, req.body.fileName].join('/');
      if (s3.isEnabled(req.realm.thirdParties.b2)) {
        try {
          const data = await s3.uploadFile(req.realm.thirdParties.b2, {
            file: req.file,
            fileName: req.body.fileName,
            url: key
          });
          return res.status(201).send(data);
        } catch (error) {
          throw new ServiceError(error, 500);
        } finally {
          try {
            fs.removeSync(req.file.path);
          } catch (err) {
            // catch error and do nothing
          }
        }
      } else {
        return res.status(201).send({
          fileName: req.body.fileName,
          key
        });
      }
    })
  );

  /**
   * @openapi
   * /documents:
   *   post:
   *     summary: Create a new document
   *     description: Creates a new document from a template or as a file descriptor
   *     tags:
   *       - Documents
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - tenantId
   *               - leaseId
   *             properties:
   *               tenantId:
   *                 type: string
   *                 description: Tenant identifier
   *               leaseId:
   *                 type: string
   *                 description: Lease identifier
   *               templateId:
   *                 type: string
   *                 description: Template identifier to use for generation
   *               type:
   *                 type: string
   *                 enum: [text, file]
   *                 description: Document type
   *               name:
   *                 type: string
   *                 description: Document name
   *               description:
   *                 type: string
   *                 description: Document description
   *               mimeType:
   *                 type: string
   *                 description: MIME type (for file type)
   *               url:
   *                 type: string
   *                 description: File URL (for file type)
   *               versionId:
   *                 type: string
   *                 description: S3 version ID (for file type)
   *               expiryDate:
   *                 type: string
   *                 format: date
   *                 description: Expiry date (for file type)
   *     responses:
   *       201:
   *         description: Document created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Document'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  documentsApi.post(
    '/',
    Middlewares.asyncWrapper(async (req, res) => {
      const dataSet = req.body || {};

      if (!dataSet.tenantId) {
        logger.error('missing tenant Id to generate document');
        throw new ServiceError('missing fields', 422);
      }

      if (!dataSet.leaseId) {
        logger.error('missing lease Id to generate document');
        throw new ServiceError('missing fields', 422);
      }

      let template;
      if (dataSet.templateId) {
        template = await _getTemplate(req.realm, dataSet.templateId);
        if (!template) {
          throw new ServiceError('template not found', 404);
        }
      }

      const documentToCreate = {
        realmId: String(req.realm._id),
        tenantId: dataSet.tenantId,
        leaseId: dataSet.leaseId,
        templateId: dataSet.templateId,
        type: dataSet.type || template.type,
        name: dataSet.name || template.name,
        description: dataSet.description || ''
      };

      if (documentToCreate.type === 'text') {
        documentToCreate.contents = '';
        documentToCreate.html = '';
        if (template) {
          const templateValues = await _getTemplateValues(
            req.realm,
            dataSet.tenantId,
            dataSet.leaseId
          );

          documentToCreate.contents = _resolveTemplates(
            template.contents,
            templateValues
          );
        }
      }

      if (documentToCreate.type === 'file') {
        documentToCreate.mimeType = dataSet.mimeType || '';
        documentToCreate.expiryDate = dataSet.expiryDate || '';
        documentToCreate.url = dataSet.url || '';
        if (dataSet.versionId) {
          documentToCreate.versionId = dataSet.versionId;
        }
      }

      const documentRepository = DataAccess.getDocumentRepository();
      const createdDocument = await documentRepository.create(documentToCreate);
      return res.status(201).json(createdDocument);
    })
  );

  /**
   * @openapi
   * /documents:
   *   patch:
   *     summary: Update a document
   *     description: Updates an existing text document (file documents cannot be modified)
   *     tags:
   *       - Documents
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             allOf:
   *               - $ref: '#/components/schemas/Document'
   *               - type: object
   *                 required:
   *                   - _id
   *     responses:
   *       201:
   *         description: Document updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Document'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       405:
   *         description: Document type cannot be modified
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: document cannot be modified
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  documentsApi.patch(
    '/',
    Middlewares.asyncWrapper(async (req, res) => {
      const organizationId = req.headers.organizationid;
      if (!req.body._id) {
        logger.error('document id is missing');
        throw new ServiceError('missing fields', 422);
      }

      const doc = req.body || {};

      if (!['text'].includes(doc.type)) {
        throw new ServiceError('document cannot be modified', 405);
      }

      const documentRepository = DataAccess.getDocumentRepository();
      const updatedDocument = await documentRepository.update(
        doc._id,
        organizationId,
        {
          ...doc,
          realmId: organizationId
        }
      );

      if (!updatedDocument) {
        throw new ServiceError('document not found', 404);
      }

      return res.status(201).json(updatedDocument);
    })
  );

  /**
   * @openapi
   * /documents/{ids}:
   *   delete:
   *     summary: Delete documents
   *     description: Deletes one or more documents by their IDs (comma-separated)
   *     tags:
   *       - Documents
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: ids
   *         required: true
   *         schema:
   *           type: string
   *         description: Comma-separated list of document IDs
   *         example: "507f1f77bcf86cd799439011,507f191e810c19729de860ea"
   *     responses:
   *       204:
   *         description: Documents deleted successfully
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  documentsApi.delete(
    '/:ids',
    Middlewares.asyncWrapper(async (req, res) => {
      const organizationId = req.headers.organizationid;
      const documentIds = req.params.ids.split(',');

      const documentRepository = DataAccess.getDocumentRepository();

      // fetch documents
      const documents = await documentRepository.findByIds(
        documentIds,
        organizationId
      );

      // delete documents from file systems
      documents.forEach((doc) => {
        if (doc.type !== 'file' || doc.url.indexOf('..') !== -1) {
          return;
        }
        const filePath = path.join(UPLOADS_DIRECTORY, doc.url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });

      // delete document from s3
      if (s3.isEnabled(req.realm.thirdParties?.b2)) {
        const urlsIds = documents
          .filter((doc) => doc.type === 'file')
          .map(({ url, versionId }) => ({ url, versionId }));

        s3.deleteFiles(req.realm.thirdParties.b2, urlsIds).catch((err) => {
          logger.error('error deleting files from s3', err);
        });
      }

      // delete documents from mongo
      const deletedCount = await documentRepository.deleteMany(
        documentIds,
        organizationId
      );

      if (deletedCount === 0) {
        throw new ServiceError('document not found', 404);
      }

      return res.sendStatus(204);
    })
  );

  return documentsApi;
}
