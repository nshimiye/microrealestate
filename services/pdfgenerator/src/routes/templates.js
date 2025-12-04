import {
  DataAccess,
  logger,
  Middlewares,
  Service,
  ServiceError
} from '@microrealestate/common';
import express from 'express';
import fs from 'fs';
import path from 'path';

/**
 * @openapi
 * components:
 *   schemas:
 *     Template:
 *       type: object
 *       required:
 *         - name
 *         - type
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique template identifier
 *         realmId:
 *           type: string
 *           description: Organization identifier
 *         name:
 *           type: string
 *           description: Template name
 *         type:
 *           type: string
 *           enum: [text, fileDescriptor]
 *           description: Template type (text for document templates, fileDescriptor for file upload templates)
 *         description:
 *           type: string
 *           description: Template description
 *         hasExpiryDate:
 *           type: boolean
 *           description: Whether documents created from this template have expiry dates (for fileDescriptor type)
 *         contents:
 *           type: object
 *           description: Template contents in TipTap JSON format with Handlebars placeholders (for text type)
 *         html:
 *           type: string
 *           description: Template HTML representation (for text type)
 *         linkedResourceIds:
 *           type: array
 *           items:
 *             type: string
 *           description: IDs of linked resources
 *         required:
 *           type: boolean
 *           description: Whether this template is required
 *         requiredOnceContractTerminated:
 *           type: boolean
 *           description: Whether this template is required once contract is terminated
 *     TemplateFields:
 *       type: object
 *       description: Available template fields for Handlebars placeholders
 *       additionalProperties: true
 */

/**
 * route: /templates
 */
const _checkTemplateParameters = ({
  name,
  type,
  hasExpiryDate,
  contents,
  html
}) => {
  const errors = [];
  if (!name) {
    errors.push('template name is missing');
  }
  if (!type) {
    errors.push('template type is missing');
  }
  if (type === 'text') {
    if (!contents) {
      errors.push('template content is missing');
    }
    if (!html) {
      errors.push('template html is missing');
    }
  } else if (type === 'fileDescriptor') {
    if (hasExpiryDate === undefined) {
      errors.push('template hasExpiryDate is missing');
    }
  }
  return errors;
};

export default function () {
  const { TEMPLATES_DIRECTORY } = Service.getInstance().envConfig.getValues();
  const FIELDS = JSON.parse(
    fs.readFileSync(path.join(TEMPLATES_DIRECTORY, 'fields.json'))
  );
  const templatesApi = express.Router();

  /**
   * @openapi
   * /templates/fields:
   *   get:
   *     summary: Get available template fields
   *     description: Retrieves the list of available fields that can be used in template placeholders
   *     tags:
   *       - Templates
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Template fields
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TemplateFields'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   */
  templatesApi.get('/fields', (req, res) => {
    res.status(200).json(FIELDS);
  });

  /**
   * @openapi
   * /templates:
   *   get:
   *     summary: Get all templates
   *     description: Retrieves all templates for the authenticated organization
   *     tags:
   *       - Templates
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of templates
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Template'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  templatesApi.get(
    '/',
    Middlewares.asyncWrapper(async (req, res) => {
      const organizationId = req.headers.organizationid;

      const templateRepository = DataAccess.getTemplateRepository();
      const templatesFound = await templateRepository.findAll(organizationId);
      if (!templatesFound) {
        throw new ServiceError('templates not found', 404);
      }

      res.status(200).json(templatesFound);
    })
  );

  /**
   * @openapi
   * /templates/{id}:
   *   get:
   *     summary: Get template by ID
   *     description: Retrieves a specific template by its ID
   *     tags:
   *       - Templates
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Template identifier
   *     responses:
   *       200:
   *         description: Template details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Template'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  templatesApi.get(
    '/:id',
    Middlewares.asyncWrapper(async (req, res) => {
      const templateId = req.params.id;

      if (!templateId) {
        logger.error('missing template id field');
        throw new ServiceError('missing fields', 422);
      }

      const templateRepository = DataAccess.getTemplateRepository();
      const templateFound = await templateRepository.findById(
        templateId,
        req.realm._id
      );

      if (!templateFound) {
        throw new ServiceError('template not found', 404);
      }

      res.status(200).json(templateFound);
    })
  );

  /**
   * @openapi
   * /templates:
   *   post:
   *     summary: Create a new template
   *     description: Creates a new document template or file descriptor template
   *     tags:
   *       - Templates
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - type
   *             properties:
   *               name:
   *                 type: string
   *                 description: Template name
   *               type:
   *                 type: string
   *                 enum: [text, fileDescriptor]
   *                 description: Template type
   *               description:
   *                 type: string
   *                 description: Template description
   *               hasExpiryDate:
   *                 type: boolean
   *                 description: Whether documents have expiry dates (required for fileDescriptor type)
   *               contents:
   *                 type: object
   *                 description: Template contents in TipTap JSON format (required for text type)
   *               html:
   *                 type: string
   *                 description: Template HTML (required for text type)
   *               linkedResourceIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Linked resource IDs
   *               required:
   *                 type: boolean
   *                 description: Whether template is required
   *               requiredOnceContractTerminated:
   *                 type: boolean
   *                 description: Whether required after contract termination
   *     responses:
   *       201:
   *         description: Template created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Template'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  templatesApi.post(
    '/',
    Middlewares.asyncWrapper(async (req, res) => {
      const organizationId = req.headers.organizationid;

      const errors = _checkTemplateParameters(req.body);
      if (errors.length) {
        logger.error(errors.join('\n'));
        throw new ServiceError('missing fields', 422);
      }

      const {
        name,
        type,
        description = '',
        hasExpiryDate,
        contents,
        html,
        linkedResourceIds,
        required,
        requiredOnceContractTerminated
      } = req.body || {};

      const templateRepository = DataAccess.getTemplateRepository();
      const createdTemplate = await templateRepository.create({
        realmId: organizationId,
        name,
        type,
        description,
        hasExpiryDate,
        contents,
        html,
        linkedResourceIds,
        required,
        requiredOnceContractTerminated
      });

      res.status(201).json(createdTemplate);
    })
  );

  /**
   * @openapi
   * /templates:
   *   patch:
   *     summary: Update a template
   *     description: Updates an existing template (replaces the entire template)
   *     tags:
   *       - Templates
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             allOf:
   *               - $ref: '#/components/schemas/Template'
   *               - type: object
   *                 required:
   *                   - _id
   *     responses:
   *       201:
   *         description: Template updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Template'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  templatesApi.patch(
    '/',
    Middlewares.asyncWrapper(async (req, res) => {
      const organizationId = req.headers.organizationid;

      let errors = _checkTemplateParameters(req.body);
      if (!req.body._id) {
        errors = ['template id is missing', ...errors];
      }
      if (errors.length) {
        logger.error(errors.join('\n'));
        throw new ServiceError('missing fields', 422);
      }

      const template = req.body || {};
      const templateRepository = DataAccess.getTemplateRepository();
      const updatedTemplate = await templateRepository.replace(
        template._id,
        organizationId,
        {
          ...template,
          realmId: organizationId
        }
      );

      if (!updatedTemplate) {
        throw new ServiceError('template not found', 404);
      }

      res.status(201).json(updatedTemplate);
    })
  );

  /**
   * @openapi
   * /templates/{ids}:
   *   delete:
   *     summary: Delete templates
   *     description: Deletes one or more templates by their IDs (comma-separated)
   *     tags:
   *       - Templates
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: ids
   *         required: true
   *         schema:
   *           type: string
   *         description: Comma-separated list of template IDs
   *         example: "507f1f77bcf86cd799439011,507f191e810c19729de860ea"
   *     responses:
   *       204:
   *         description: Templates deleted successfully
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  templatesApi.delete(
    '/:ids',
    Middlewares.asyncWrapper(async (req, res) => {
      const organizationId = req.headers.organizationid;
      const templateIds = req.params.ids.split(',');
      
      const templateRepository = DataAccess.getTemplateRepository();
      const deletedCount = await templateRepository.deleteMany(
        templateIds,
        organizationId
      );

      if (deletedCount === 0) {
        throw new ServiceError('template not found', 404);
      }

      res.sendStatus(204);
    })
  );

  return templatesApi;
}
