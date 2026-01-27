import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import purchaseService from '../services/purchase.service';

export class PurchaseController {
  createPurchase = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const purchase = await purchaseService.createPurchase({
        ...req.body,
        organizationId,
      });

      res.status(201).json({
        success: true,
        message: 'Purchase created successfully',
        data: purchase,
      });
    }
  );

  getAllPurchases = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const { search, page, limit, vendorId, status, dateFrom, dateTo } = req.query;

      const result = await purchaseService.getAllPurchases({
        organizationId,
        search: search as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        vendorId: vendorId ? parseInt(vendorId as string) : undefined,
        status: status as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    }
  );

  getPurchaseById = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id);

      const purchase = await purchaseService.getPurchaseById(organizationId, id);

      res.status(200).json({
        success: true,
        data: purchase,
      });
    }
  );

  updatePurchaseStatus = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id);
      const { status } = req.body;

      const purchase = await purchaseService.updatePurchaseStatus(organizationId, id, status);

      res.status(200).json({
        success: true,
        message: 'Purchase status updated successfully',
        data: purchase,
      });
    }
  );
}

export default new PurchaseController();
