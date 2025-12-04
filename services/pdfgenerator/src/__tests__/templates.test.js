import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { DataAccess } from '@microrealestate/common';
import templatesRoute from '../routes/templates.js';

describe('Templates API - Backward Compatibility', () => {
  let app;
  let testRealm;

  beforeEach(async () => {
    // Create test app
    app = express();
    app.use(express.json());

    // Mock middleware to inject realm and headers
    app.use((req, res, next) => {
      req.realm = testRealm;
      req.headers.organizationid = testRealm._id;
      next();
    });

    app.use('/templates', templatesRoute());

    // Error handling middleware
    app.use((err, req, res, next) => {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Internal server error' });
    });

    // Create test realm
    const realmRepository = DataAccess.getRealmRepository();
    testRealm = await realmRepository.create({
      name: 'Test Organization',
      locale: 'en',
      currency: 'USD'
    });
  });

  describe('GET /templates', () => {
    it('should return all templates for the realm', async () => {
      const templateRepository = DataAccess.getTemplateRepository();
      await templateRepository.create({
        realmId: testRealm._id,
        name: 'Template 1',
        type: 'text',
        description: 'Description 1',
        contents: { type: 'doc', content: [] },
        html: '<p>Test 1</p>'
      });

      await templateRepository.create({
        realmId: testRealm._id,
        name: 'Template 2',
        type: 'fileDescriptor',
        description: 'Description 2',
        hasExpiryDate: true
      });

      const response = await request(app).get('/templates').expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('_id');
      expect(response.body[0]).toHaveProperty('realmId');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('type');
    });

    it('should return 404 when no templates exist', async () => {
      const response = await request(app).get('/templates').expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('templates not found');
    });
  });

  describe('GET /templates/:id', () => {
    it('should return a template by ID', async () => {
      const templateRepository = DataAccess.getTemplateRepository();
      const template = await templateRepository.create({
        realmId: testRealm._id,
        name: 'Test Template',
        type: 'text',
        description: 'Test description',
        contents: { type: 'doc', content: [] },
        html: '<p>Test</p>'
      });

      const response = await request(app)
        .get(`/templates/${template._id}`)
        .expect(200);

      expect(response.body).toHaveProperty('_id');
      expect(response.body._id.toString()).toBe(template._id.toString());
      expect(response.body.name).toBe('Test Template');
      expect(response.body.type).toBe('text');
      expect(response.body).toHaveProperty('contents');
      expect(response.body).toHaveProperty('html');
    });

    it('should return 404 for non-existent template', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/templates/${fakeId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('template not found');
    });
  });

  describe('POST /templates', () => {
    it('should create a text template', async () => {
      const response = await request(app)
        .post('/templates')
        .send({
          name: 'New Template',
          type: 'text',
          description: 'New template description',
          contents: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Hello World' }]
              }
            ]
          },
          html: '<p>Hello World</p>',
          linkedResourceIds: [],
          required: false,
          requiredOnceContractTerminated: false
        })
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.name).toBe('New Template');
      expect(response.body.type).toBe('text');
      expect(response.body.description).toBe('New template description');
      expect(response.body).toHaveProperty('contents');
      expect(response.body).toHaveProperty('html');
    });

    it('should create a fileDescriptor template', async () => {
      const response = await request(app)
        .post('/templates')
        .send({
          name: 'File Template',
          type: 'fileDescriptor',
          description: 'File template description',
          hasExpiryDate: true,
          linkedResourceIds: ['resource1'],
          required: true,
          requiredOnceContractTerminated: false
        })
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.name).toBe('File Template');
      expect(response.body.type).toBe('fileDescriptor');
      expect(response.body.hasExpiryDate).toBe(true);
      expect(response.body.required).toBe(true);
    });

    it('should return 422 when name is missing', async () => {
      const response = await request(app)
        .post('/templates')
        .send({
          type: 'text',
          contents: { type: 'doc', content: [] },
          html: '<p>Test</p>'
        })
        .expect(422);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('missing fields');
    });

    it('should return 422 when type is missing', async () => {
      const response = await request(app)
        .post('/templates')
        .send({
          name: 'Test Template',
          contents: { type: 'doc', content: [] },
          html: '<p>Test</p>'
        })
        .expect(422);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('missing fields');
    });

    it('should return 422 when text template missing contents', async () => {
      const response = await request(app)
        .post('/templates')
        .send({
          name: 'Test Template',
          type: 'text',
          html: '<p>Test</p>'
        })
        .expect(422);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('missing fields');
    });

    it('should return 422 when text template missing html', async () => {
      const response = await request(app)
        .post('/templates')
        .send({
          name: 'Test Template',
          type: 'text',
          contents: { type: 'doc', content: [] }
        })
        .expect(422);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('missing fields');
    });

    it('should return 422 when fileDescriptor template missing hasExpiryDate', async () => {
      const response = await request(app)
        .post('/templates')
        .send({
          name: 'Test Template',
          type: 'fileDescriptor'
        })
        .expect(422);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('missing fields');
    });
  });

  describe('PATCH /templates', () => {
    it('should update a template', async () => {
      const templateRepository = DataAccess.getTemplateRepository();
      const template = await templateRepository.create({
        realmId: testRealm._id,
        name: 'Original Name',
        type: 'text',
        description: 'Original description',
        contents: { type: 'doc', content: [] },
        html: '<p>Original</p>'
      });

      const response = await request(app)
        .patch('/templates')
        .send({
          _id: template._id.toString(),
          name: 'Updated Name',
          type: 'text',
          description: 'Updated description',
          contents: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Updated' }] }]
          },
          html: '<p>Updated</p>'
        })
        .expect(201);

      expect(response.body._id.toString()).toBe(template._id.toString());
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.description).toBe('Updated description');
    });

    it('should return 422 when _id is missing', async () => {
      const response = await request(app)
        .patch('/templates')
        .send({
          name: 'Test',
          type: 'text',
          contents: { type: 'doc', content: [] },
          html: '<p>Test</p>'
        })
        .expect(422);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('missing fields');
    });

    it('should return 422 when required fields are missing', async () => {
      const templateRepository = DataAccess.getTemplateRepository();
      const template = await templateRepository.create({
        realmId: testRealm._id,
        name: 'Test',
        type: 'text',
        contents: { type: 'doc', content: [] },
        html: '<p>Test</p>'
      });

      const response = await request(app)
        .patch('/templates')
        .send({
          _id: template._id.toString(),
          name: 'Updated Name'
          // Missing type, contents, html
        })
        .expect(422);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('missing fields');
    });

    it('should return 404 when template not found', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .patch('/templates')
        .send({
          _id: fakeId,
          name: 'Test',
          type: 'text',
          contents: { type: 'doc', content: [] },
          html: '<p>Test</p>'
        })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('template not found');
    });
  });

  describe('DELETE /templates/:ids', () => {
    it('should delete single template', async () => {
      const templateRepository = DataAccess.getTemplateRepository();
      const template = await templateRepository.create({
        realmId: testRealm._id,
        name: 'Test Template',
        type: 'text',
        contents: { type: 'doc', content: [] },
        html: '<p>Test</p>'
      });

      await request(app).delete(`/templates/${template._id}`).expect(204);

      // Verify template was deleted
      const found = await templateRepository.findById(
        template._id,
        testRealm._id
      );
      expect(found).toBeNull();
    });

    it('should delete multiple templates', async () => {
      const templateRepository = DataAccess.getTemplateRepository();
      const template1 = await templateRepository.create({
        realmId: testRealm._id,
        name: 'Template 1',
        type: 'text',
        contents: { type: 'doc', content: [] },
        html: '<p>Test 1</p>'
      });

      const template2 = await templateRepository.create({
        realmId: testRealm._id,
        name: 'Template 2',
        type: 'text',
        contents: { type: 'doc', content: [] },
        html: '<p>Test 2</p>'
      });

      await request(app)
        .delete(`/templates/${template1._id},${template2._id}`)
        .expect(204);

      // Verify templates were deleted
      const found1 = await templateRepository.findById(
        template1._id,
        testRealm._id
      );
      const found2 = await templateRepository.findById(
        template2._id,
        testRealm._id
      );
      expect(found1).toBeNull();
      expect(found2).toBeNull();
    });

    it('should return 404 when template not found', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .delete(`/templates/${fakeId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('template not found');
    });
  });
});
