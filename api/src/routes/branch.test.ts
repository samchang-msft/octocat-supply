import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import branchRouter from './branch';
import { runMigrations } from '../db/migrate';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { errorHandler } from '../utils/errors';

let app: express.Express;

describe('Branch API', () => {
  beforeEach(async () => {
    // Ensure a fresh in-memory database for each test
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);

    // Seed required foreign key: headquarters id 1
    const db = await getDatabase();
    await db.run('INSERT INTO headquarters (headquarters_id, name) VALUES (?, ?)', [1, 'HQ One']);

    // Set up express app
    app = express();
    app.use(express.json());
    app.use('/branches', branchRouter);
    // Attach error handler to translate repo errors
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('should create a new branch', async () => {
    const newBranch = {
      headquartersId: 1,
      name: 'Eastside Branch',
      description: 'Eastern district branch',
      address: '321 East St',
      contactPerson: 'Emma Davis',
      email: 'edavis@octo.com',
      phone: '555-0203',
    };
    const response = await request(app).post('/branches').send(newBranch);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject(newBranch);
    expect(response.body.branchId).toBeDefined();
  });

  it('should get all branches', async () => {
    const response = await request(app).get('/branches');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body).toHaveProperty('page', 0);
    expect(response.body).toHaveProperty('pageSize', 20);
    expect(response.body).toHaveProperty('total');
  });

  it('should get a branch by ID', async () => {
    // First create a branch to test getting it
    const newBranch = {
      headquartersId: 1,
      name: 'Test Branch',
      description: 'Test branch',
      address: '123 Test St',
      contactPerson: 'Test Person',
      email: 'test@test.com',
      phone: '555-0000',
    };
    const createResponse = await request(app).post('/branches').send(newBranch);
    const branchId = createResponse.body.branchId;

    const response = await request(app).get(`/branches/${branchId}`);
    expect(response.status).toBe(200);
    expect(response.body.branchId).toBe(branchId);
  });

  it('should update a branch by ID', async () => {
    // First create a branch to test updating it
    const newBranch = {
      headquartersId: 1,
      name: 'Original Branch',
      description: 'Original description',
      address: '123 Original St',
      contactPerson: 'Original Person',
      email: 'original@test.com',
      phone: '555-0001',
    };
    const createResponse = await request(app).post('/branches').send(newBranch);
    const branchId = createResponse.body.branchId;

    const updatedBranch = {
      ...newBranch,
      name: 'Updated Branch Name',
    };
    const response = await request(app).put(`/branches/${branchId}`).send(updatedBranch);
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated Branch Name');
  });

  it('should delete a branch by ID', async () => {
    // First create a branch to test deleting it
    const newBranch = {
      headquartersId: 1,
      name: 'Delete Me Branch',
      description: 'This branch will be deleted',
      address: '123 Delete St',
      contactPerson: 'Delete Person',
      email: 'delete@test.com',
      phone: '555-9999',
    };
    const createResponse = await request(app).post('/branches').send(newBranch);
    const branchId = createResponse.body.branchId;

    const response = await request(app).delete(`/branches/${branchId}`);
    expect(response.status).toBe(204);
  });

  it('should return 404 for non-existing branch', async () => {
    const response = await request(app).get('/branches/999');
    expect(response.status).toBe(404);
  });

  it('should support pageSize and page query parameters', async () => {
    const response = await request(app).get('/branches?pageSize=5&page=0');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('page', 0);
    expect(response.body).toHaveProperty('pageSize', 5);
    expect(response.body).toHaveProperty('total');
  });

  it('should return 400 for pageSize greater than 100', async () => {
    const response = await request(app).get('/branches?pageSize=101');
    expect(response.status).toBe(400);
  });

  it('should return 400 for pageSize less than 1', async () => {
    const response = await request(app).get('/branches?pageSize=0');
    expect(response.status).toBe(400);
  });

  it('should return 400 for negative page', async () => {
    const response = await request(app).get('/branches?page=-1');
    expect(response.status).toBe(400);
  });

  it('should return 400 for non-numeric pageSize', async () => {
    const response = await request(app).get('/branches?pageSize=abc');
    expect(response.status).toBe(400);
  });

  it('should paginate results correctly', async () => {
    // Create 3 branches
    const branchData = {
      headquartersId: 1,
      name: 'Pagination Branch',
      description: 'Branch for pagination test',
      address: '123 Page St',
      contactPerson: 'Page Person',
      email: 'page@test.com',
      phone: '555-1111',
    };
    await request(app).post('/branches').send({ ...branchData, name: 'Branch A' });
    await request(app).post('/branches').send({ ...branchData, name: 'Branch B' });
    await request(app).post('/branches').send({ ...branchData, name: 'Branch C' });

    const page0 = await request(app).get('/branches?pageSize=2&page=0');
    expect(page0.status).toBe(200);
    expect(page0.body.data.length).toBe(2);
    expect(page0.body.total).toBe(3);

    const page1 = await request(app).get('/branches?pageSize=2&page=1');
    expect(page1.status).toBe(200);
    expect(page1.body.data.length).toBe(1);
  });
});
