import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import orderRouter from './order';
import { runMigrations } from '../db/migrate';
import { closeDatabase, getDatabase } from '../db/sqlite';
import { errorHandler } from '../utils/errors';

let app: express.Express;

async function seedOrder(orderDate: string, name: string): Promise<void> {
  const db = await getDatabase();
  await db.run(
    'INSERT INTO orders (branch_id, order_date, name, description, status) VALUES (?, ?, ?, ?, ?)',
    [1, orderDate, name, `${name} description`, 'pending'],
  );
}

describe('Order API', () => {
  beforeEach(async () => {
    await closeDatabase();
    await getDatabase(true);
    await runMigrations(true);

    const db = await getDatabase();
    await db.run('INSERT INTO headquarters (headquarters_id, name) VALUES (?, ?)', [1, 'HQ One']);
    await db.run('INSERT INTO branches (branch_id, headquarters_id, name) VALUES (?, ?, ?)', [
      1,
      1,
      'Branch One',
    ]);

    app = express();
    app.use(express.json());
    app.use('/orders', orderRouter);
    app.use(errorHandler);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('returns orders wrapped in an object sorted by newest orderDate first', async () => {
    await seedOrder('2026-01-01T00:00:00.000Z', 'Oldest');
    await seedOrder('2026-01-03T00:00:00.000Z', 'Newest');
    await seedOrder('2026-01-02T00:00:00.000Z', 'Middle');

    const response = await request(app).get('/orders');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.orders)).toBe(true);
    expect(response.body.orders.map((order: { name: string }) => order.name)).toEqual([
      'Newest',
      'Middle',
      'Oldest',
    ]);
  });

  it('supports pageSize and page query params for pagination', async () => {
    for (let day = 1; day <= 5; day += 1) {
      await seedOrder(`2026-01-0${day}T00:00:00.000Z`, `Order ${day}`);
    }

    const response = await request(app).get('/orders?pageSize=2&page=1');

    expect(response.status).toBe(200);
    expect(response.body.orders.map((order: { name: string }) => order.name)).toEqual([
      'Order 3',
      'Order 2',
    ]);
  });

  it('returns 400 for invalid pageSize', async () => {
    const response = await request(app).get('/orders?pageSize=101');
    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid page', async () => {
    const response = await request(app).get('/orders?page=-1');
    expect(response.status).toBe(400);
  });
});
