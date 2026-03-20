import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { bookingController } from "../controllers/booking.controller.js";

const router = Router();

router.post('/handle-incoming-message', bookingController.handleIncomingMessage);

router.use(authMiddleware); 
router.get('/get-all-bookings', bookingController.getBookings);

export default router;