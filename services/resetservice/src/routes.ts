import * as Express from 'express';
import { Middlewares, Service } from '@microrealestate/common';

/**
 * @openapi
 * components:
 *   schemas:
 *     ResetResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: success
 *           description: Status message indicating successful reset
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *   responses:
 *     InternalServerError:
 *       description: Internal server error during database reset
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 */

const routes = Express.Router();

/**
 * @openapi
 * /reset:
 *   delete:
 *     summary: Reset all databases
 *     description: |
 *       **WARNING: DEV/CI ONLY** - This endpoint drops all MongoDB collections and clears all Redis keys.
 *       This operation is irreversible and should only be used in development and CI environments.
 *       
 *       Collections dropped:
 *       - accounts
 *       - contracts
 *       - documents
 *       - emails
 *       - landloards
 *       - leases
 *       - occupants
 *       - properties
 *       - realms
 *       - templates
 *       
 *       All Redis keys are also deleted.
 *     tags:
 *       - Database Reset
 *     responses:
 *       200:
 *         description: Database reset successful
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: success
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
routes.delete(
  '/reset',
  Middlewares.asyncWrapper(
    async (req: Express.Request, res: Express.Response<string>) => {
      const mongoClient = Service.getInstance().mongoClient;
      await Promise.all(
        [
          'accounts',
          'contracts',
          'documents',
          'emails',
          'landloards',
          'leases',
          'occupants',
          'properties',
          'realms',
          'templates'
        ].map((collection) =>
          mongoClient?.dropCollection(collection).catch(console.error)
        )
      );

      const redis = Service.getInstance().redisClient;
      const keys = await redis?.keys('*');
      if (keys?.length) {
        await Promise.all(keys.map((key) => redis?.del(key)));
      }
      return res.status(200).send('success');
    }
  )
);

export default routes;
