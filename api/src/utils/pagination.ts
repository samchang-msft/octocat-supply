import type { Request, Response } from 'express';

export interface PaginationParams {
  page: number;
  pageSize: number;
}

/**
 * Parse and validate pagination query parameters from the request.
 * Returns the parsed params on success, or sends a 400 response and returns null.
 */
export function parsePaginationParams(req: Request, res: Response): PaginationParams | null {
  const pageSize = req.query.pageSize !== undefined ? parseInt(req.query.pageSize as string, 10) : 20;
  const page = req.query.page !== undefined ? parseInt(req.query.page as string, 10) : 0;

  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
    res.status(400).json({ error: 'Invalid pageSize: must be between 1 and 100' });
    return null;
  }
  if (isNaN(page) || page < 0) {
    res.status(400).json({ error: 'Invalid page: must be 0 or greater' });
    return null;
  }

  return { page, pageSize };
}
