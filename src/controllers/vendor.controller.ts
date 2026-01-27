import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import vendorService from '../services/vendor.service';

export class VendorController {
  createVendor = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const vendor = await vendorService.createVendor(organizationId, req.body);

      res.status(201).json({
        success: true,
        message: 'Vendor created successfully',
        data: vendor,
      });
    }
  );

  getAllVendors = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const { search, page, limit, isActive } = req.query;

      const result = await vendorService.getAllVendors({
        organizationId,
        search: search as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    }
  );

  getVendorById = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id);

      const vendor = await vendorService.getVendorById(organizationId, id);

      res.status(200).json({
        success: true,
        data: vendor,
      });
    }
  );

  updateVendor = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id);

      const vendor = await vendorService.updateVendor(organizationId, id, req.body);

      res.status(200).json({
        success: true,
        message: 'Vendor updated successfully',
        data: vendor,
      });
    }
  );

  deleteVendor = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id);

      const result = await vendorService.deleteVendor(organizationId, id);

      res.status(200).json({
        success: true,
        ...result,
      });
    }
  );
}

export default new VendorController();
