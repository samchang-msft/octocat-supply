import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import orderRouter from './order';
import { runMigrations } from '../db/migrate';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { errorHandler } from '../utils/errors';

let app: express.Express;

describe('Order API', () => {
  beforeEach(async () => {
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);

    // Seed required foreign key: headquarters and branch
    const db = await getDatabase();
    await db.run('INSERT INTO headquarters (headquarters_id, name) VALUES (?, ?)', [1, 'HQ One']);
    await db.run(
      'INSERT INTO branches (branch_id, headquarters_id, name) VALUES (?, ?, ?)',
      [1, 1, 'Branch One'],
    );

    app = express();
    app.use(express.json());
    app.use('/orders', orderRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  const newOrder = {
    branchId: 1,
    orderDate: '2024-01-15T00:00:00.000Z',
    name: 'Test Order',
    description: 'A test order',
    status: 'pending',
  };

  it('should create a new order', async () => {
    const response = await request(app).post('/orders').send(newOrder);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: 'Test Order' });
    expect(response.body.orderId).toBeDefined();
  });

  it('should get all orders with default pagination', async () => {
    const response = await request(app).get('/orders');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body).toHaveProperty('page', 0);
    expect(response.body).toHaveProperty('pageSize', 20);
    expect(response.body).toHaveProperty('total');
  });

  it('should get an order by ID', async () => {
    const createResponse = await request(app).post('/orders').send(newOrder);
    const orderId = createResponse.body.orderId;

    const response = await request(app).get(`/orders/${orderId}`);
    expect(response.status).toBe(200);
    expect(response.body.orderId).toBe(orderId);
  });

  it('should return 404 for non-existing order', async () => {
    const response = await request(app).get('/orders/999');
    expect(response.status).toBe(404);
  });

  it('should return 400 for pageSize greater than 100', async () => {
    const response = await request(app).get('/orders?pageSize=101');
    expect(response.status).toBe(400);
  });

  it('should return 400 for pageSize less than 1', async () => {
    const response = await request(app).get('/orders?pageSize=0');
    expect(response.status).toBe(400);
  });

  it('should return 400 for negative page', async () => {
    const response = await request(app).get('/orders?page=-1');
    expect(response.status).toBe(400);
  });

  it('should return 400 for non-numeric pageSize', async () => {
    const response = await request(app).get('/orders?pageSize=abc');
    expect(response.status).toBe(400);
  });

  it('should paginate results correctly', async () => {
    await request(app)
      .post('/orders')
      .send({ ...newOrder, orderDate: '2024-01-01T00:00:00.000Z', name: 'Order A' });
    await request(app)
      .post('/orders')
      .send({ ...newOrder, orderDate: '2024-01-02T00:00:00.000Z', name: 'Order B' });
    await request(app)
      .post('/orders')
      .send({ ...newOrder, orderDate: '2024-01-03T00:00:00.000Z', name: 'Order C' });

    const page0 = await request(app).get('/orders?pageSize=2&page=0');
    expect(page0.status).toBe(200);
    expect(page0.body.data.length).toBe(2);
    expect(page0.body.total).toBe(3);

    const page1 = await request(app).get('/orders?pageSize=2&page=1');
    expect(page1.status).toBe(200);
    expect(page1.body.data.length).toBe(1);
  });

  it('should return orders sorted by orderDate descending', async () => {
    await request(app)
      .post('/orders')
      .send({ ...newOrder, orderDate: '2024-01-01T00:00:00.000Z', name: 'Oldest Order' });
    await request(app)
      .post('/orders')
      .send({ ...newOrder, orderDate: '2024-03-01T00:00:00.000Z', name: 'Newest Order' });
    await request(app)
      .post('/orders')
      .send({ ...newOrder, orderDate: '2024-02-01T00:00:00.000Z', name: 'Middle Order' });

    const response = await request(app).get('/orders');
    expect(response.status).toBe(200);
    const dates = response.body.data.map((o: any) => o.orderDate);
    for (let i = 1; i < dates.length; i++) {
      expect(new Date(dates[i - 1]).getTime()).toBeGreaterThanOrEqual(new Date(dates[i]).getTime());
    }
  });

  it('should use custom pageSize and page', async () => {
    const response = await request(app).get('/orders?pageSize=10&page=0');
    expect(response.status).toBe(200);
    expect(response.body.page).toBe(0);
    expect(response.body.pageSize).toBe(10);
  });
});
