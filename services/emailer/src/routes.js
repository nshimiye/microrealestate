/**
 * @openapi
 * components:
 *   schemas:
 *     EmailRequest:
 *       type: object
 *       required:
 *         - templateName
 *         - recordId
 *       properties:
 *         templateName:
 *           type: string
 *           description: Email template name
 *           enum: [invoice, rentcall, rentcall_reminder, rentcall_last_reminder, reset_password, otp]
 *           example: invoice
 *         recordId:
 *           type: string
 *           description: Database record ID (tenant ID, lease ID, etc.)
 *           example: 507f1f77bcf86cd799439011
 *         params:
 *           type: object
 *           description: Additional parameters for email template (e.g., term, token)
 *           additionalProperties: true
 *           example:
 *             term: 2024030100
 *     EmailResult:
 *       type: object
 *       properties:
 *         templateName:
 *           type: string
 *           description: Email template that was sent
 *           example: invoice
 *         recordId:
 *           type: string
 *           description: Record ID for which email was sent
 *           example: 507f1f77bcf86cd799439011
 *         params:
 *           type: object
 *           description: Parameters used in email generation
 *         sentTo:
 *           type: array
 *           items:
 *             type: string
 *             format: email
 *           description: Email addresses to which the email was sent
 *           example: [tenant@example.com]
 *         status:
 *           type: string
 *           enum: [sent, failed]
 *           description: Email delivery status
 *           example: sent
 *         error:
 *           type: string
 *           description: Error message if email failed to send
 *     EmailStatusResponse:
 *       type: object
 *       properties:
 *         term:
 *           type: integer
 *           description: Term identifier (YYYYMMDD format)
 *           example: 2024030100
 *         emailsSent:
 *           type: integer
 *           description: Number of emails sent for this term
 *           example: 15
 *         emailsFailed:
 *           type: integer
 *           description: Number of emails that failed to send
 *           example: 2
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *         statusCode:
 *           type: integer
 *           description: HTTP status code
 *   responses:
 *     UnauthorizedError:
 *       description: Access token is missing or invalid
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             error: Unauthorized
 *             statusCode: 401
 *     ForbiddenError:
 *       description: Access forbidden - insufficient permissions
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             error: Forbidden
 *             statusCode: 403
 *     NotFoundError:
 *       description: Template not found
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             error: template not found
 *             statusCode: 404
 *     ValidationError:
 *       description: Missing or invalid fields
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             error: missing fields
 *             statusCode: 422
 *     InternalServerError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             error: Internal server error
 *             statusCode: 500
 */

import * as Emailer from './emailer.js';
import {
  logger,
  Middlewares,
  Service,
  ServiceError
} from '@microrealestate/common';
import express from 'express';
import locale from 'locale';

async function _send(req, res) {
  const { templateName, recordId, params } = req.body;
  let allowedTemplates;
  switch (req.path) {
    case '/emailer/resetpassword':
      allowedTemplates = ['reset_password'];
      break;
    case '/emailer/otp':
      allowedTemplates = ['otp'];
      break;
    default:
      allowedTemplates = [
        'invoice',
        'rentcall',
        'rentcall_last_reminder',
        'rentcall_reminder'
      ];
      break;
  }
  if (!allowedTemplates.includes(templateName)) {
    logger.warn(`template not found ${templateName}`);
    throw new ServiceError('template not found', 404);
  }

  // TODO: pass headers in params
  const results = await Emailer.send(
    req.headers.authorization,
    req.realm?.locale || req.rawLocale.code,
    req.realm?.currency || '',
    req.realm?._id || req.headers.organizationid,
    templateName,
    recordId,
    params
  );

  if (!results || !results.length) {
    throw new ServiceError(
      `no results returned by the email engine after sending the email ${templateName}`,
      500
    );
  }

  res.json(results);
}

export default function routes() {
  const { ACCESS_TOKEN_SECRET } = Service.getInstance().envConfig.getValues();
  const apiRouter = express.Router();
  // parse locale
  apiRouter.use(locale(['fr-FR', 'en', 'pt-BR', 'de-DE', 'es-CO'], 'en')); // used when organization is not set
  
  /**
   * @openapi
   * /emailer/resetpassword:
   *   post:
   *     summary: Send password reset email
   *     description: Sends a password reset email with a reset token. This endpoint does not require authentication.
   *     tags:
   *       - Email
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - templateName
   *               - recordId
   *               - params
   *             properties:
   *               templateName:
   *                 type: string
   *                 enum: [reset_password]
   *                 example: reset_password
   *               recordId:
   *                 type: string
   *                 description: User email address
   *                 example: user@example.com
   *               params:
   *                 type: object
   *                 required:
   *                   - token
   *                 properties:
   *                   token:
   *                     type: string
   *                     description: Password reset token
   *                     example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   *     responses:
   *       200:
   *         description: Email sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/EmailResult'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  apiRouter.post('/emailer/resetpassword', Middlewares.asyncWrapper(_send)); // allow this route even there is no access token
  
  /**
   * @openapi
   * /emailer/otp:
   *   post:
   *     summary: Send one-time password email
   *     description: Sends an OTP (one-time password) email for authentication. This endpoint does not require authentication.
   *     tags:
   *       - Email
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - templateName
   *               - recordId
   *               - params
   *             properties:
   *               templateName:
   *                 type: string
   *                 enum: [otp]
   *                 example: otp
   *               recordId:
   *                 type: string
   *                 description: User identifier
   *                 example: 507f1f77bcf86cd799439011
   *               params:
   *                 type: object
   *                 properties:
   *                   code:
   *                     type: string
   *                     description: One-time password code
   *                     example: "123456"
   *     responses:
   *       200:
   *         description: Email sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/EmailResult'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  apiRouter.post('/emailer/otp', Middlewares.asyncWrapper(_send)); // allow this route even there is no access token
  apiRouter.use(
    Middlewares.needAccessToken(ACCESS_TOKEN_SECRET),
    Middlewares.checkOrganization(),
    Middlewares.notRoles(['tenant'])
  );

  /**
   * @openapi
   * /emailer/status/{startTerm}/{endTerm}:
   *   get:
   *     summary: Get email sending status for a term range
   *     description: Retrieves email sending statistics for a specified term or term range
   *     tags:
   *       - Email
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: startTerm
   *         required: true
   *         schema:
   *           type: integer
   *           example: 2024030100
   *         description: Start term in YYYYMMDD format
   *       - in: path
   *         name: endTerm
   *         required: false
   *         schema:
   *           type: integer
   *           example: 2024040100
   *         description: End term in YYYYMMDD format (optional)
   *     responses:
   *       200:
   *         description: Email status retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/EmailStatusResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  apiRouter.get(
    '/emailer/status/:startTerm/:endTerm?',
    Middlewares.asyncWrapper(async (req, res) => {
      const { startTerm, endTerm } = req.params;
      const result = await Emailer.status(
        null,
        Number(startTerm),
        endTerm ? Number(endTerm) : null
      );
      res.json(result);
    })
  );

  /**
   * @openapi
   * /emailer:
   *   post:
   *     summary: Send email using template
   *     description: Sends an email using a specified template (invoice, rentcall, rentcall_reminder, rentcall_last_reminder). Requires authentication and landlord/administrator role.
   *     tags:
   *       - Email
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/EmailRequest'
   *           examples:
   *             invoice:
   *               summary: Send invoice email
   *               value:
   *                 templateName: invoice
   *                 recordId: 507f1f77bcf86cd799439011
   *                 params:
   *                   term: 2024030100
   *             rentcall:
   *               summary: Send rent call email
   *               value:
   *                 templateName: rentcall
   *                 recordId: 507f1f77bcf86cd799439011
   *                 params:
   *                   term: 2024030100
   *             rentcall_reminder:
   *               summary: Send rent call reminder
   *               value:
   *                 templateName: rentcall_reminder
   *                 recordId: 507f1f77bcf86cd799439011
   *                 params:
   *                   term: 2024030100
   *     responses:
   *       200:
   *         description: Email sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/EmailResult'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  apiRouter.post('/emailer', Middlewares.asyncWrapper(_send));

  return apiRouter;
}
