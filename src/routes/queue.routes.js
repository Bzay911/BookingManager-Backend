import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { queueController } from "../controllers/queue.controller.js";

const router = Router();

router.use(authMiddleware);

router.get('/get-live-queue', queueController.getLiveQueue);
router.get('/get-available-slots/:serviceId', queueController.getAvaliableSlots);
router.post('/add-walkins', queueController.addWalkins);

export default router;