/**
 * @swagger
 * tags:
 *   name: Products
 *   description: API endpoints for managing products
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Returns all products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: List of all products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *
 * /api/products/{id}:
 *   get:
 *     summary: Get a product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *   put:
 *     summary: Update a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *   delete:
 *     summary: Delete a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       204:
 *         description: Product deleted successfully
 *       404:
 *         description: Product not found
 */

import express from 'express';
import { Product } from '../models/product';
import { getProductsRepository } from '../repositories/productsRepo';
import { NotFoundError } from '../utils/errors';

const router = express.Router();

// Create a new product
router.post('/', async (req, res, next) => {
  try {
    const repo = await getProductsRepository();
    const newProduct = await repo.create(req.body as Omit<Product, 'productId'>);
    res.status(201).json(newProduct);
  } catch (error) {
    next(error);
  }
});

// Get all products
router.get('/', async (req, res, next) => {
  try {
    const pageSize = req.query.pageSize !== undefined ? parseInt(req.query.pageSize as string, 10) : 20;
    const page = req.query.page !== undefined ? parseInt(req.query.page as string, 10) : 0;

    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      res.status(400).json({ error: 'Invalid pageSize: must be between 1 and 100' });
      return;
    }
    if (isNaN(page) || page < 0) {
      res.status(400).json({ error: 'Invalid page: must be 0 or greater' });
      return;
    }

    const repo = await getProductsRepository();
    const result = await repo.findAllPaginated(page, pageSize);
    res.json({ data: result.data, page, pageSize, total: result.total });
  } catch (error) {
    next(error);
  }
});

// Get a product by ID
router.get('/:id', async (req, res, next) => {
  try {
    const repo = await getProductsRepository();
    const product = await repo.findById(parseInt(req.params.id));
    if (product) {
      res.json(product);
    } else {
      res.status(404).send('Product not found');
    }
  } catch (error) {
    next(error);
  }
});

// Get a product by name
router.get('/name/:name', async (req, res, next) => {
  try {
    const repo = await getProductsRepository();
    const product = await repo.findByName(req.params.name);
    if (product) {
      res.json(product);
    } else {
      res.status(404).send('Product not found');
    }
  } catch (error) {
    next(error);
  }
});

// Update a product by ID
router.put('/:id', async (req, res, next) => {
  try {
    const repo = await getProductsRepository();
    const updatedProduct = await repo.update(parseInt(req.params.id), req.body);
    res.json(updatedProduct);
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).send('Product not found');
    } else {
      next(error);
    }
  }
});

// Delete a product by ID
router.delete('/:id', async (req, res, next) => {
  try {
    const repo = await getProductsRepository();
    await repo.delete(parseInt(req.params.id));
    res.status(204).send();
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).send('Product not found');
    } else {
      next(error);
    }
  }
});

export default router;
