import * as Express from 'express';
import { Controllers } from './controllers/index.js';
import { Middlewares } from '@microrealestate/common';

const routes = Express.Router();

/**
 * @openapi
 * /tenants:
 *   get:
 *     summary: Get all tenants for authenticated user
 *     description: Retrieves a list of all tenants associated with the authenticated tenant user's email address
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successful response with tenant data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TenantData'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
routes.get('/tenants', Middlewares.asyncWrapper(Controllers.getAllTenants));

/**
 * @openapi
 * /tenant/{tenantId}:
 *   get:
 *     summary: Get specific tenant information
 *     description: Retrieves detailed information for a specific tenant, including lease details, invoices, and payment history
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the tenant
 *     responses:
 *       200:
 *         description: Successful response with tenant data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TenantData'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Tenant not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
routes.get(
  '/tenant/:tenantId',
  Middlewares.asyncWrapper(Controllers.getOneTenant)
);

/**
 * @openapi
 * components:
 *   schemas:
 *     TenantData:
 *       type: object
 *       description: Complete tenant information including lease, landlord, and payment details
 *       properties:
 *         tenant:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               description: Unique tenant identifier
 *             name:
 *               type: string
 *               description: Tenant full name
 *             contacts:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     description: Contact person name
 *                   email:
 *                     type: string
 *                     format: email
 *                     description: Contact email address
 *                   phone1:
 *                     type: string
 *                     description: Primary phone number
 *             addresses:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Address'
 *         landlord:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               description: Landlord organization name
 *             currency:
 *               type: string
 *               description: Currency code (e.g., USD, EUR)
 *             locale:
 *               type: string
 *               description: Locale code (e.g., en-US, fr-FR)
 *             addresses:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Address'
 *             contacts:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                     format: email
 *                   phone1:
 *                     type: string
 *                   phone2:
 *                     type: string
 *         lease:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               description: Lease name or identifier
 *             beginDate:
 *               type: string
 *               format: date
 *               description: Lease start date
 *             endDate:
 *               type: string
 *               format: date
 *               description: Lease end date
 *             terminationDate:
 *               type: string
 *               format: date
 *               description: Lease termination date (if terminated early)
 *             timeRange:
 *               type: string
 *               enum: [days, weeks, months, years]
 *               description: Billing period frequency
 *             status:
 *               type: string
 *               enum: [active, ended, terminated]
 *               description: Current lease status
 *             rent:
 *               type: object
 *               properties:
 *                 totalPreTaxAmount:
 *                   type: number
 *                   description: Rent amount before tax
 *                 totalChargesAmount:
 *                   type: number
 *                   description: Additional charges amount
 *                 totalVatAmount:
 *                   type: number
 *                   description: VAT/tax amount
 *                 totalAmount:
 *                   type: number
 *                   description: Total rent amount including all charges and taxes
 *             remainingIterations:
 *               type: integer
 *               description: Number of remaining billing periods
 *             remainingIterationsToPay:
 *               type: integer
 *               description: Number of remaining billing periods to pay
 *             properties:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   type:
 *                     type: string
 *             documents:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   url:
 *                     type: string
 *                     format: uri
 *             invoices:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Invoice'
 *             balance:
 *               type: number
 *               description: Current account balance (positive means credit, negative means debt)
 *             deposit:
 *               type: number
 *               description: Security deposit amount held
 *     Invoice:
 *       type: object
 *       description: Rent invoice for a specific billing period
 *       properties:
 *         id:
 *           type: string
 *           description: Unique invoice identifier
 *         term:
 *           type: integer
 *           description: Billing term in YYYYMMDDHH format
 *         balance:
 *           type: number
 *           description: Invoice balance (amount owed or overpaid)
 *         grandTotal:
 *           type: number
 *           description: Total invoice amount
 *         payment:
 *           type: number
 *           description: Amount paid towards this invoice
 *         payments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Payment date
 *               method:
 *                 type: string
 *                 description: Payment method used
 *               reference:
 *                 type: string
 *                 description: Payment reference number
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *         status:
 *           type: string
 *           enum: [paid, partially-paid, unpaid]
 *           description: Payment status of the invoice
 *         methods:
 *           type: array
 *           items:
 *             type: string
 *           description: Payment methods used for this invoice
 *     Address:
 *       type: object
 *       description: Physical address
 *       properties:
 *         street1:
 *           type: string
 *           description: Street address line 1
 *         street2:
 *           type: string
 *           description: Street address line 2
 *         zipCode:
 *           type: string
 *           description: Postal/ZIP code
 *         city:
 *           type: string
 *           description: City name
 *         state:
 *           type: string
 *           description: State or province
 *         country:
 *           type: string
 *           description: Country name
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *         message:
 *           type: string
 *           description: Detailed error description
 *   responses:
 *     UnauthorizedError:
 *       description: Access token is missing or invalid
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             error: unauthorized
 *     InternalServerError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             error: Internal server error
 */

export default routes;
