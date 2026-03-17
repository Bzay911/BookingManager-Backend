import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { bookingController } from "../controllers/booking.controller.js";

const router = Router();

router.use(authMiddleware); 
router.post('/handle-incoming-message', bookingController.handleIncomingMessage);
export default router;