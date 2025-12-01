/**
 * @openapi
 * components:
 *   schemas:
 *     SignUpRequest:
 *       type: object
 *       required:
 *         - firstname
 *         - lastname
 *         - email
 *         - password
 *       properties:
 *         firstname:
 *           type: string
 *           description: User's first name
 *           example: John
 *         lastname:
 *           type: string
 *           description: User's last name
 *           example: Doe
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *           example: john.doe@example.com
 *         password:
 *           type: string
 *           format: password
 *           description: User password
 *           example: mySecurePassword123
 *     SignInRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *           example: user@example.com
 *         password:
 *           type: string
 *           format: password
 *           description: User password
 *           example: mySecurePassword123
 *     SignInResponse:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           description: JWT access token (expires in 30 seconds)
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     RefreshTokenResponse:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           description: New JWT access token
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
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
 *       description: Invalid credentials or expired token
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             error: invalid credentials
 *             statusCode: 401
 *     ForbiddenError:
 *       description: Access forbidden
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             error: invalid credentials
 *             statusCode: 403
 *     ValidationError:
 *       description: Missing or invalid fields
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             error: missing fields
 *             statusCode: 422
 */

import {
  Collections,
  logger,
  Middlewares,
  Service,
  ServiceError
} from '@microrealestate/common';
import axios from 'axios';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import locale from 'locale';

const _generateTokens = async (dbAccount) => {
  const { REFRESH_TOKEN_SECRET, ACCESS_TOKEN_SECRET, PRODUCTION } =
    Service.getInstance().envConfig.getValues();
  const { _id, password, ...account } = dbAccount;
  const refreshToken = jwt.sign({ account }, REFRESH_TOKEN_SECRET, {
    expiresIn: PRODUCTION ? '600s' : '12h'
  });
  const accessToken = jwt.sign({ account }, ACCESS_TOKEN_SECRET, {
    expiresIn: '30s'
  });

  // save tokens
  await Service.getInstance().redisClient.set(refreshToken, accessToken);

  return {
    refreshToken,
    accessToken
  };
};

const _refreshTokens = async (oldRefreshToken) => {
  const { REFRESH_TOKEN_SECRET } = Service.getInstance().envConfig.getValues();
  const oldAccessToken =
    await Service.getInstance().redisClient.get(oldRefreshToken);
  if (!oldAccessToken) {
    logger.error('refresh token not found in database');
    return {};
  }

  let account;
  try {
    const payload = jwt.verify(oldRefreshToken, REFRESH_TOKEN_SECRET);
    if (payload && payload.account) {
      account = payload.account;
    }
  } catch (exc) {
    logger.error(exc);
  }
  await _clearTokens(oldRefreshToken);

  if (!account) {
    return {};
  }

  return await _generateTokens(account);
};

const _clearTokens = async (refreshToken) => {
  await Service.getInstance().redisClient.del(refreshToken);
};

const _applicationSignIn = Middlewares.asyncWrapper(async (req, res) => {
  const { APPCREDZ_TOKEN_SECRET, ACCESS_TOKEN_SECRET } =
    Service.getInstance().envConfig.getValues();
  const { clientId, clientSecret } = req.body;
  if (
    [clientId, clientSecret].map((el) => el.trim()).some((el) => !!el === false)
  ) {
    logger.error('M2M login failed some fields are missing');
    throw new ServiceError('missing fields', 422);
  }

  // clientSecret is a JWT which contains the organizationId & clientId
  let organizationId;
  let keyId;
  let payload;
  try {
    payload = jwt.verify(clientSecret, APPCREDZ_TOKEN_SECRET);
  } catch (exc) {
    if (exc instanceof jwt.TokenExpiredError) {
      logger.info(
        `login failed for application ${clientId}@${organizationId}: expired token`
      );
      throw new ServiceError('expired clientId', 401);
    } else {
      throw new ServiceError('invalid credentials', 401);
    }
  }

  if (payload?.organizationId && payload?.jti) {
    organizationId = payload.organizationId;
    keyId = payload.jti;
  } else {
    logger.error(
      'Provided clientSecret is valid but does not have required fields'
    );
    throw new ServiceError('invalid credentials', 401);
  }

  // ensure keyId & clientId matches
  if (clientId !== keyId) {
    logger.info(
      `login failed for application ${clientId}@${organizationId}: clientId & clientSecret not matching`
    );
    throw new ServiceError('invalid credentials', 401);
  }

  // find the client details within the realm
  const realm = (
    await Collections.Realm.findOne({ _id: organizationId })
  )?.toObject();
  if (!realm) {
    logger.info(
      `login failed for application ${clientId}@${organizationId}: realm not found`
    );
    throw new ServiceError('invalid credentials', 401);
  }
  const application = realm.applications?.find(
    (app) => app?.clientId === clientId
  );
  if (!application) {
    logger.info(
      `login failed for application ${clientId}@${organizationId}: appplication revoked`
    );
    throw new ServiceError('revoked clientId', 401);
  }

  // check clientSecret
  const validSecret = await bcrypt.compare(
    clientSecret,
    application.clientSecret
  );
  if (!validSecret) {
    logger.info(
      `login failed for application ${clientId}@${organizationId}: bad secret`
    );
    throw new ServiceError('invalid credentials', 401);
  }

  // Generate only an accessToken, but no refreshToken
  delete application.clientSecret;
  const accessToken = jwt.sign({ application }, ACCESS_TOKEN_SECRET, {
    expiresIn: '300s'
  });

  res.json({
    accessToken,
    organizationId
  });
});

const _userSignIn = Middlewares.asyncWrapper(async (req, res) => {
  const { TOKEN_COOKIE_ATTRIBUTES } =
    Service.getInstance().envConfig.getValues();
  const { email, password } = req.body;
  if ([email, password].map((el) => el.trim()).some((el) => !!el === false)) {
    logger.error('login failed some fields are missing');
    throw new ServiceError('missing fields', 422);
  }

  const account = await Collections.Account.findOne({
    email: email.toLowerCase()
  }).lean();

  if (!account) {
    logger.info(`login failed for ${email} account not found`);
    throw new ServiceError('invalid credentials', 401);
  }

  const validPassword = await bcrypt.compare(password, account.password);
  if (!validPassword) {
    logger.info(`login failed for ${email} bad password`);
    throw new ServiceError('invalid credentials', 401);
  }

  const { refreshToken, accessToken } = await _generateTokens(account);

  logger.debug(
    `create a new refresh token ${refreshToken} for domain ${req.hostname}`
  );
  res.cookie('refreshToken', refreshToken, TOKEN_COOKIE_ATTRIBUTES);
  res.json({
    accessToken
  });
});

export default function () {
  const {
    APPCREDZ_TOKEN_SECRET,
    ACCESS_TOKEN_SECRET,
    EMAILER_URL,
    RESET_TOKEN_SECRET,
    SIGNUP,
    TOKEN_COOKIE_ATTRIBUTES
  } = Service.getInstance().envConfig.getValues();
  const landlordRouter = express.Router();

  // parse locale
  landlordRouter.use(
    locale(['fr-FR', 'en-US', 'pt-BR', 'de-DE', 'es-CO'], 'en-US')
  );

  // if (SIGNUP) {
    /**
     * @openapi
     * /landlord/signup:
     *   post:
     *     summary: Sign up for a new landlord account
     *     description: Creates a new landlord account with the provided user information. Returns 201 even if account exists to prevent account enumeration.
     *     tags:
     *       - Authentication
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/SignUpRequest'
     *     responses:
     *       201:
     *         description: Account created successfully (or already exists)
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     */
    landlordRouter.post(
      '/signup',
      Middlewares.asyncWrapper(async (req, res) => {
        const { firstname, lastname, email, password } = req.body;
        if (
          [firstname, lastname, email, password]
            .map((el) => el.trim())
            .some((el) => !!el === false)
        ) {
          throw new ServiceError('missing fields', 422);
        }
        const existingAccount = await Collections.Account.findOne({
          email: email.toLowerCase()
        });
        if (existingAccount) {
          // status code 200 to avoid account enumeration
          return res.sendStatus(201);
        }
        await Collections.Account.create({
          firstname,
          lastname,
          email,
          password
        });
        res.sendStatus(201);
      })
    );
  // }

  /**
   * @openapi
   * /landlord/signin:
   *   post:
   *     summary: Sign in to the landlord portal
   *     description: Authenticates a user with email and password, returns an access token and sets a refresh token cookie
   *     tags:
   *       - Authentication
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/SignInRequest'
   *     responses:
   *       200:
   *         description: Successful authentication
   *         headers:
   *           Set-Cookie:
   *             description: HTTP-only cookie containing refresh token
   *             schema:
   *               type: string
   *               example: refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; HttpOnly; Secure; SameSite=Strict
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SignInResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       422:
   *         $ref: '#/components/responses/ValidationError'
   */
  landlordRouter.post(
    '/signin',
    Middlewares.asyncWrapper(async (req, res) => {
      if (!req.body.email && !req.body.clientId) {
        throw new ServiceError('missing fields', 422);
      }

      if (req.body.email) {
        return await _userSignIn(req, res);
      }

      if (req.body.clientId) {
        return await _applicationSignIn(req, res);
      }
    })
  );

  landlordRouter.use(
    '/appcredz',
    Middlewares.needAccessToken(ACCESS_TOKEN_SECRET)
  );
  landlordRouter.use('/appcredz', Middlewares.checkOrganization());
  landlordRouter.post(
    '/appcredz',
    Middlewares.asyncWrapper(async (req, res) => {
      // ensure the user is administrator
      if (req.user.role !== 'administrator') {
        throw new ServiceError(
          'your current role does not allow to perform this action',
          403
        );
      }

      const { expiry, organizationId } = req.body;
      if (
        [expiry, organizationId]
          .map((el) => el.trim())
          .some((el) => !!el === false)
      ) {
        logger.error('AppCredz creation failed some fields are missing');
        throw new ServiceError('missing fields', 422);
      }
      const expiryDate = new Date(expiry);

      // Create clientId & clientSecret
      const clientId = crypto.randomUUID();
      const clientSecret = jwt.sign(
        {
          organizationId,
          jti: clientId,
          exp: expiryDate.getTime() / 1000
        },
        APPCREDZ_TOKEN_SECRET
      );

      res.json({
        clientId,
        clientSecret
      });
    })
  );

  /**
   * @openapi
   * /landlord/refreshtoken:
   *   post:
   *     summary: Refresh access token
   *     description: Exchanges a valid refresh token (from cookie) for a new access token and refresh token
   *     tags:
   *       - Authentication
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Successfully refreshed tokens
   *         headers:
   *           Set-Cookie:
   *             description: HTTP-only cookie containing new refresh token
   *             schema:
   *               type: string
   *               example: refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; HttpOnly; Secure; SameSite=Strict
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/RefreshTokenResponse'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  landlordRouter.post(
    '/refreshtoken',
    Middlewares.asyncWrapper(async (req, res) => {
      const oldRefreshToken = req.cookies.refreshToken;
      logger.debug(`give a new refresh token for ${oldRefreshToken}`);
      if (!oldRefreshToken) {
        logger.debug('missing refresh token');
        throw new ServiceError('invalid credentials', 403);
      }

      const { refreshToken, accessToken } =
        await _refreshTokens(oldRefreshToken);
      if (!refreshToken) {
        res.clearCookie('refreshToken', TOKEN_COOKIE_ATTRIBUTES);
        throw new ServiceError('invalid credentials', 403);
      }

      res.cookie('refreshToken', refreshToken, TOKEN_COOKIE_ATTRIBUTES);
      res.json({
        accessToken
      });
    })
  );

  /**
   * @openapi
   * /landlord/signout:
   *   delete:
   *     summary: Sign out from the landlord portal
   *     description: Invalidates the refresh token and clears the authentication cookie
   *     tags:
   *       - Authentication
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       202:
   *         description: Accepted (no refresh token present)
   *       204:
   *         description: Successfully signed out
   *         headers:
   *           Set-Cookie:
   *             description: Clears the refresh token cookie
   *             schema:
   *               type: string
   *               example: refreshToken=; Max-Age=0
   */
  landlordRouter.delete(
    '/signout',
    Middlewares.asyncWrapper(async (req, res) => {
      const refreshToken = req.cookies.refreshToken;
      logger.debug(`remove the refresh token: ${refreshToken}`);
      if (!refreshToken) {
        return res.sendStatus(202);
      }

      res.clearCookie('refreshToken', TOKEN_COOKIE_ATTRIBUTES);
      await _clearTokens(refreshToken);
      res.sendStatus(204);
    })
  );

  landlordRouter.post(
    '/forgotpassword',
    Middlewares.asyncWrapper(async (req, res) => {
      const { email } = req.body;
      if (!email) {
        logger.error('missing email field');
        throw new ServiceError('missing fields', 422);
      }
      // check if user exists
      const account = await Collections.Account.findOne({
        email: email.toLowerCase()
      });
      if (account) {
        // generate reset token valid for one hour
        const token = jwt.sign({ email }, RESET_TOKEN_SECRET, {
          expiresIn: '1h'
        });
        await Service.getInstance().redisClient.set(token, email);

        // send email
        await axios.post(
          `${EMAILER_URL}/resetpassword`,
          {
            templateName: 'reset_password',
            recordId: email,
            params: {
              token
            }
          },
          {
            headers: {
              'Accept-Language': req.rawLocale.code
            }
          }
        );
      }
      res.sendStatus(204);
    })
  );

  landlordRouter.patch(
    '/resetpassword',
    Middlewares.asyncWrapper(async (req, res) => {
      const { resetToken, password } = req.body;
      if (
        [resetToken, password]
          .map((el) => el.trim())
          .some((el) => !!el === false)
      ) {
        throw new ServiceError('missing fields', 422);
      }

      const email = await Service.getInstance().redisClient.get(resetToken);
      if (!email) {
        throw new ServiceError('invalid credentials', 403);
      }

      await Service.getInstance().redisClient.del(resetToken);

      try {
        jwt.verify(resetToken, RESET_TOKEN_SECRET);
      } catch (error) {
        throw new ServiceError(error, 403);
      }

      const account = await Collections.Account.findOne({
        email: email.toLowerCase()
      });
      account.password = password;
      await account.save();

      res.sendStatus(200);
    })
  );

  return landlordRouter;
}
