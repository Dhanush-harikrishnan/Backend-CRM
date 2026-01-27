import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import interactionService from '../services/interaction.service';

export class InteractionController {
  createInteraction = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const userId = req.user!.userId;

      const interaction = await interactionService.createInteraction({
        ...req.body,
        organizationId,
        userId,
      });

      res.status(201).json({
        success: true,
        message: 'Interaction logged successfully',
        data: interaction,
      });
    }
  );

  getInteractions = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const { customerId, userId, type, dateFrom, dateTo, page, limit } = req.query;

      const result = await interactionService.getInteractions({
        organizationId,
        customerId: customerId ? parseInt(customerId as string) : undefined,
        userId: userId as string,
        type: type as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    }
  );

  getInteractionById = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id);

      const interaction = await interactionService.getInteractionById(organizationId, id);

      res.status(200).json({
        success: true,
        data: interaction,
      });
    }
  );

  updateInteraction = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id);

      const interaction = await interactionService.updateInteraction(organizationId, id, req.body);

      res.status(200).json({
        success: true,
        message: 'Interaction updated successfully',
        data: interaction,
      });
    }
  );

  deleteInteraction = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const id = parseInt(req.params.id);

      const result = await interactionService.deleteInteraction(organizationId, id);

      res.status(200).json({
        success: true,
        ...result,
      });
    }
  );
}

export default new InteractionController();
