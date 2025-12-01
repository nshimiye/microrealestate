/**
 * @openapi
 * components:
 *   schemas:
 *     Realm:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier
 *         name:
 *           type: string
 *           description: Organization name
 *         members:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *         isCompany:
 *           type: boolean
 *         companyInfo:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             legalStructure:
 *               type: string
 *             capital:
 *               type: number
 *             ein:
 *               type: string
 *             dos:
 *               type: string
 *             vatNumber:
 *               type: string
 *             legalRepresentative:
 *               type: string
 *         addresses:
 *           type: array
 *           items:
 *             type: object
 *         bankInfo:
 *           type: object
 *         locale:
 *           type: string
 *         currency:
 *           type: string
 *     Tenant:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier
 *         name:
 *           type: string
 *           description: Tenant full name
 *         isCompany:
 *           type: boolean
 *         companyInfo:
 *           type: object
 *         manager:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         phone1:
 *           type: string
 *         phone2:
 *           type: string
 *         contacts:
 *           type: array
 *           items:
 *             type: object
 *         contract:
 *           type: string
 *         leaseId:
 *           type: string
 *         properties:
 *           type: array
 *           items:
 *             type: object
 *         beginDate:
 *           type: string
 *           format: date
 *         endDate:
 *           type: string
 *           format: date
 *         terminationDate:
 *           type: string
 *           format: date
 *         guaranty:
 *           type: number
 *         guarantyPayback:
 *           type: number
 *         reference:
 *           type: string
 *         discount:
 *           type: number
 *     Property:
 *       type: object
 *       required:
 *         - name
 *         - type
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier
 *         name:
 *           type: string
 *           description: Property name
 *         type:
 *           type: string
 *           enum: [apartment, house, commercial, parking, other]
 *           description: Property type
 *         surface:
 *           type: number
 *           description: Surface area
 *         phone:
 *           type: string
 *         digicode:
 *           type: string
 *         address:
 *           type: object
 *           properties:
 *             street1:
 *               type: string
 *             street2:
 *               type: string
 *             city:
 *               type: string
 *             zipCode:
 *               type: string
 *             state:
 *               type: string
 *             country:
 *               type: string
 *         price:
 *           type: number
 *           description: Base rent price
 *         expense:
 *           type: number
 *           description: Additional expenses
 *         priceWithExpenses:
 *           type: number
 *           description: Total price including expenses
 *         occupantLabel:
 *           type: string
 *     Lease:
 *       type: object
 *       required:
 *         - name
 *         - numberOfTerms
 *         - timeRange
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier
 *         name:
 *           type: string
 *           description: Lease template name
 *         description:
 *           type: string
 *           description: Lease description
 *         numberOfTerms:
 *           type: integer
 *           description: Number of payment terms
 *         timeRange:
 *           type: string
 *           enum: [days, weeks, months, years]
 *           description: Time range for each term
 *         active:
 *           type: boolean
 *           description: Whether this lease template is active
 *         system:
 *           type: boolean
 *           description: Whether this is a system-defined lease
 *     Rent:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier
 *         term:
 *           type: integer
 *           description: Payment term number
 *         month:
 *           type: integer
 *           description: Month (1-12)
 *         year:
 *           type: integer
 *           description: Year
 *         occupant:
 *           type: object
 *           description: Tenant information
 *         totalAmount:
 *           type: number
 *           description: Total amount due
 *         payment:
 *           type: number
 *           description: Amount paid
 *         discount:
 *           type: number
 *           description: Discount applied
 *         promo:
 *           type: number
 *         extracharge:
 *           type: number
 *         noteExtracharge:
 *           type: string
 *         description:
 *           type: string
 *         countMonthNotPaid:
 *           type: integer
 *         status:
 *           type: string
 *           description: Payment status
 *     Dashboard:
 *       type: object
 *       properties:
 *         overview:
 *           type: object
 *           properties:
 *             propertyCount:
 *               type: integer
 *             occupantCount:
 *               type: integer
 *             occupiedCount:
 *               type: integer
 *             vacantCount:
 *               type: integer
 *         settlements:
 *           type: object
 *         revenues:
 *           type: object
 *         topUnpaid:
 *           type: array
 *           items:
 *             type: object
 *     EmailRequest:
 *       type: object
 *       required:
 *         - document
 *         - tenantIds
 *       properties:
 *         document:
 *           type: string
 *           description: Document type to send
 *         tenantIds:
 *           type: array
 *           items:
 *             type: string
 *           description: List of tenant IDs
 *         year:
 *           type: integer
 *         month:
 *           type: integer
 *         term:
 *           type: integer
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
 *       description: Resource not found
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             error: Not found
 *             statusCode: 404
 *     ValidationError:
 *       description: Invalid request data
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             error: Validation failed
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

import * as accountingManager from './managers/accountingmanager.js';
import * as dashboardManager from './managers/dashboardmanager.js';
import * as emailManager from './managers/emailmanager.js';
import * as leaseManager from './managers/leasemanager.js';
import * as occupantManager from './managers/occupantmanager.js';
import * as propertyManager from './managers/propertymanager.js';
import * as realmManager from './managers/realmmanager.js';
import * as rentManager from './managers/rentmanager.js';
import { Middlewares, Service } from '@microrealestate/common';
import express from 'express';

export default function routes() {
  const { ACCESS_TOKEN_SECRET } = Service.getInstance().envConfig.getValues();
  const router = express.Router();
  router.use(
    // protect the api access by checking the access token
    Middlewares.needAccessToken(ACCESS_TOKEN_SECRET),
    // update req with the user organizations
    Middlewares.checkOrganization(),
    // forbid access to tenant
    Middlewares.notRoles(['tenant'])
  );

  const realmsRouter = express.Router();
  
  /**
   * @openapi
   * /realms:
   *   get:
   *     summary: Get all realms (organizations)
   *     description: Retrieves a list of all organizations/realms accessible to the authenticated user
   *     tags:
   *       - Realms
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Realm'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  realmsRouter.get('/', realmManager.all);
  
  /**
   * @openapi
   * /realms/{id}:
   *   get:
   *     summary: Get a specific realm
   *     description: Retrieves details of a specific organization/realm by ID
   *     tags:
   *       - Realms
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Realm ID
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Realm'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  realmsRouter.get('/:id', realmManager.one);
  
  /**
   * @openapi
   * /realms:
   *   post:
   *     summary: Create a new realm
   *     description: Creates a new organization/realm
   *     tags:
   *       - Realms
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Realm'
   *     responses:
   *       201:
   *         description: Realm created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Realm'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  realmsRouter.post('/', Middlewares.asyncWrapper(realmManager.add));
  
  /**
   * @openapi
   * /realms/{id}:
   *   patch:
   *     summary: Update a realm
   *     description: Updates an existing organization/realm
   *     tags:
   *       - Realms
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Realm ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Realm'
   *     responses:
   *       200:
   *         description: Realm updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Realm'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  realmsRouter.patch('/:id', Middlewares.asyncWrapper(realmManager.update));
  router.use('/realms', realmsRouter);

  const dashboardRouter = express.Router();
  
  /**
   * @openapi
   * /dashboard:
   *   get:
   *     summary: Get dashboard data
   *     description: Retrieves dashboard overview including property counts, occupancy, revenues, and settlements
   *     tags:
   *       - Dashboard
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Dashboard'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  dashboardRouter.get('/', Middlewares.asyncWrapper(dashboardManager.all));
  router.use('/dashboard', dashboardRouter);

  const leasesRouter = express.Router();
  
  /**
   * @openapi
   * /leases:
   *   get:
   *     summary: Get all lease templates
   *     description: Retrieves a list of all lease templates for the organization
   *     tags:
   *       - Leases
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Lease'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  leasesRouter.get('/', Middlewares.asyncWrapper(leaseManager.all));
  
  /**
   * @openapi
   * /leases/{id}:
   *   get:
   *     summary: Get a specific lease template
   *     description: Retrieves details of a specific lease template by ID
   *     tags:
   *       - Leases
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Lease template ID
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Lease'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  leasesRouter.get('/:id', Middlewares.asyncWrapper(leaseManager.one));
  
  /**
   * @openapi
   * /leases:
   *   post:
   *     summary: Create a new lease template
   *     description: Creates a new lease template
   *     tags:
   *       - Leases
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Lease'
   *     responses:
   *       201:
   *         description: Lease template created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Lease'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  leasesRouter.post('/', Middlewares.asyncWrapper(leaseManager.add));
  
  /**
   * @openapi
   * /leases/{id}:
   *   patch:
   *     summary: Update a lease template
   *     description: Updates an existing lease template
   *     tags:
   *       - Leases
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Lease template ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Lease'
   *     responses:
   *       200:
   *         description: Lease template updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Lease'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  leasesRouter.patch('/:id', Middlewares.asyncWrapper(leaseManager.update));
  
  /**
   * @openapi
   * /leases/{ids}:
   *   delete:
   *     summary: Delete lease templates
   *     description: Deletes one or more lease templates (comma-separated IDs)
   *     tags:
   *       - Leases
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: ids
   *         required: true
   *         schema:
   *           type: string
   *         description: Comma-separated lease template IDs
   *     responses:
   *       204:
   *         description: Lease templates deleted successfully
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  leasesRouter.delete('/:ids', Middlewares.asyncWrapper(leaseManager.remove));
  router.use('/leases', leasesRouter);

  const occupantsRouter = express.Router();
  
  /**
   * @openapi
   * /tenants:
   *   get:
   *     summary: Get all tenants
   *     description: Retrieves a list of all tenants for the organization
   *     tags:
   *       - Tenants
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Tenant'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  occupantsRouter.get('/', Middlewares.asyncWrapper(occupantManager.all));
  
  /**
   * @openapi
   * /tenants/{id}:
   *   get:
   *     summary: Get a specific tenant
   *     description: Retrieves details of a specific tenant by ID
   *     tags:
   *       - Tenants
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Tenant ID
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Tenant'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  occupantsRouter.get('/:id', Middlewares.asyncWrapper(occupantManager.one));
  
  /**
   * @openapi
   * /tenants:
   *   post:
   *     summary: Create a new tenant
   *     description: Creates a new tenant record
   *     tags:
   *       - Tenants
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Tenant'
   *     responses:
   *       201:
   *         description: Tenant created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Tenant'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  occupantsRouter.post('/', Middlewares.asyncWrapper(occupantManager.add));
  
  /**
   * @openapi
   * /tenants/{id}:
   *   patch:
   *     summary: Update a tenant
   *     description: Updates an existing tenant record
   *     tags:
   *       - Tenants
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Tenant ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Tenant'
   *     responses:
   *       200:
   *         description: Tenant updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Tenant'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  occupantsRouter.patch(
    '/:id',
    Middlewares.asyncWrapper(occupantManager.update)
  );
  
  /**
   * @openapi
   * /tenants/{ids}:
   *   delete:
   *     summary: Delete tenants
   *     description: Deletes one or more tenants (comma-separated IDs)
   *     tags:
   *       - Tenants
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: ids
   *         required: true
   *         schema:
   *           type: string
   *         description: Comma-separated tenant IDs
   *     responses:
   *       204:
   *         description: Tenants deleted successfully
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  occupantsRouter.delete(
    '/:ids',
    Middlewares.asyncWrapper(occupantManager.remove)
  );
  router.use('/tenants', occupantsRouter);

  const rentsRouter = express.Router();
  
  /**
   * @openapi
   * /rents/{year}/{month}:
   *   get:
   *     summary: Get rents by month
   *     description: Retrieves all rent records for a specific month and year
   *     tags:
   *       - Rents
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: year
   *         required: true
   *         schema:
   *           type: integer
   *         description: Year (e.g., 2024)
   *       - in: path
   *         name: month
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 12
   *         description: Month (1-12)
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Rent'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  rentsRouter.get('/:year/:month', Middlewares.asyncWrapper(rentManager.all));
  
  /**
   * @openapi
   * /rents/tenant/{id}:
   *   get:
   *     summary: Get all rents for a tenant
   *     description: Retrieves all rent records for a specific tenant
   *     tags:
   *       - Rents
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Tenant ID
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Rent'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  rentsRouter.get(
    '/tenant/:id',
    Middlewares.asyncWrapper(rentManager.rentsOfOccupant)
  );
  
  /**
   * @openapi
   * /rents/tenant/{id}/{term}:
   *   get:
   *     summary: Get rent for a tenant by term
   *     description: Retrieves a specific rent record for a tenant by term number
   *     tags:
   *       - Rents
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Tenant ID
   *       - in: path
   *         name: term
   *         required: true
   *         schema:
   *           type: integer
   *         description: Term number
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Rent'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  rentsRouter.get(
    '/tenant/:id/:term',
    Middlewares.asyncWrapper(rentManager.rentOfOccupantByTerm)
  );
  
  /**
   * @openapi
   * /rents/payment/{id}/{term}:
   *   patch:
   *     summary: Update rent payment
   *     description: Updates payment information for a specific rent record
   *     tags:
   *       - Rents
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Tenant ID
   *       - in: path
   *         name: term
   *         required: true
   *         schema:
   *           type: integer
   *         description: Term number
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               payment:
   *                 type: number
   *                 description: Payment amount
   *               extracharge:
   *                 type: number
   *               noteExtracharge:
   *                 type: string
   *               promo:
   *                 type: number
   *               description:
   *                 type: string
   *     responses:
   *       200:
   *         description: Payment updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Rent'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  rentsRouter.patch(
    '/payment/:id/:term',
    Middlewares.asyncWrapper(rentManager.updateByTerm)
  );
  router.use('/rents', rentsRouter);

  const propertiesRouter = express.Router();
  
  /**
   * @openapi
   * /properties:
   *   get:
   *     summary: Get all properties
   *     description: Retrieves a list of all properties for the organization
   *     tags:
   *       - Properties
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Property'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  propertiesRouter.get('/', Middlewares.asyncWrapper(propertyManager.all));
  
  /**
   * @openapi
   * /properties/{id}:
   *   get:
   *     summary: Get a specific property
   *     description: Retrieves details of a specific property by ID
   *     tags:
   *       - Properties
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Property ID
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Property'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  propertiesRouter.get('/:id', Middlewares.asyncWrapper(propertyManager.one));
  
  /**
   * @openapi
   * /properties:
   *   post:
   *     summary: Create a new property
   *     description: Creates a new property record
   *     tags:
   *       - Properties
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Property'
   *     responses:
   *       201:
   *         description: Property created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Property'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  propertiesRouter.post('/', Middlewares.asyncWrapper(propertyManager.add));
  
  /**
   * @openapi
   * /properties/{id}:
   *   patch:
   *     summary: Update a property
   *     description: Updates an existing property record
   *     tags:
   *       - Properties
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Property ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Property'
   *     responses:
   *       200:
   *         description: Property updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Property'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  propertiesRouter.patch(
    '/:id',
    Middlewares.asyncWrapper(propertyManager.update)
  );
  
  /**
   * @openapi
   * /properties/{ids}:
   *   delete:
   *     summary: Delete properties
   *     description: Deletes one or more properties (comma-separated IDs)
   *     tags:
   *       - Properties
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: ids
   *         required: true
   *         schema:
   *           type: string
   *         description: Comma-separated property IDs
   *     responses:
   *       204:
   *         description: Properties deleted successfully
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  propertiesRouter.delete(
    '/:ids',
    Middlewares.asyncWrapper(propertyManager.remove)
  );
  router.use('/properties', propertiesRouter);

  /**
   * @openapi
   * /accounting/{year}:
   *   get:
   *     summary: Get accounting data for a year
   *     description: Retrieves accounting overview and financial data for a specific year
   *     tags:
   *       - Accounting
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: year
   *         required: true
   *         schema:
   *           type: integer
   *         description: Year (e.g., 2024)
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 year:
   *                   type: integer
   *                 revenues:
   *                   type: object
   *                 expenses:
   *                   type: object
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.get(
    '/accounting/:year',
    Middlewares.asyncWrapper(accountingManager.all)
  );
  
  /**
   * @openapi
   * /csv/tenants/incoming/{year}:
   *   get:
   *     summary: Export incoming tenants CSV
   *     description: Exports a CSV file of tenants who started their lease in the specified year
   *     tags:
   *       - Accounting
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: year
   *         required: true
   *         schema:
   *           type: integer
   *         description: Year (e.g., 2024)
   *     responses:
   *       200:
   *         description: CSV file
   *         content:
   *           text/csv:
   *             schema:
   *               type: string
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.get(
    '/csv/tenants/incoming/:year',
    Middlewares.asyncWrapper(accountingManager.csv.incomingTenants)
  );
  
  /**
   * @openapi
   * /csv/tenants/outgoing/{year}:
   *   get:
   *     summary: Export outgoing tenants CSV
   *     description: Exports a CSV file of tenants who ended their lease in the specified year
   *     tags:
   *       - Accounting
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: year
   *         required: true
   *         schema:
   *           type: integer
   *         description: Year (e.g., 2024)
   *     responses:
   *       200:
   *         description: CSV file
   *         content:
   *           text/csv:
   *             schema:
   *               type: string
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.get(
    '/csv/tenants/outgoing/:year',
    Middlewares.asyncWrapper(accountingManager.csv.outgoingTenants)
  );
  
  /**
   * @openapi
   * /csv/settlements/{year}:
   *   get:
   *     summary: Export settlements CSV
   *     description: Exports a CSV file of rent settlements for the specified year
   *     tags:
   *       - Accounting
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: year
   *         required: true
   *         schema:
   *           type: integer
   *         description: Year (e.g., 2024)
   *     responses:
   *       200:
   *         description: CSV file
   *         content:
   *           text/csv:
   *             schema:
   *               type: string
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.get(
    '/csv/settlements/:year',
    Middlewares.asyncWrapper(accountingManager.csv.settlements)
  );

  const emailRouter = express.Router();
  
  /**
   * @openapi
   * /emails:
   *   post:
   *     summary: Send emails to tenants
   *     description: Sends documents or notices to one or more tenants via email
   *     tags:
   *       - Emails
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/EmailRequest'
   *     responses:
   *       200:
   *         description: Emails sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: success
   *                 sent:
   *                   type: integer
   *                   description: Number of emails sent
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  emailRouter.post('/', Middlewares.asyncWrapper(emailManager.send));
  router.use('/emails', emailRouter);

  const apiRouter = express.Router();
  apiRouter.use('/api/v2', router);

  return apiRouter;
}
