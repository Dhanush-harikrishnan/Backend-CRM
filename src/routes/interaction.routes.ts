import { Router } from 'express';
import interactionController from '../controllers/interaction.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createInteractionSchema,
  updateInteractionSchema,
  interactionListQuerySchema
} from '../validators';

const router = Router();

// Protect all routes
router.use(authenticate);

router.post(
  '/',
  validate(createInteractionSchema),
  interactionController.createInteraction
);

router.get(
  '/',
  validate(interactionListQuerySchema),
  interactionController.getInteractions
);

router.get(
  '/:id',
  interactionController.getInteractionById
);

router.put(
  '/:id',
  validate(updateInteractionSchema),
  interactionController.updateInteraction
);

router.delete(
  '/:id',
  interactionController.deleteInteraction
);

export default router;
