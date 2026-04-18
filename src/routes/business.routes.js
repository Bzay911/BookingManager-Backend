import { Router } from "express";
import  {businessController}  from "../controllers/business.controller.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

router.get('/get-all-businesses', businessController.getAllBusinesses);
router.get('/get-business/:id', businessController.fetchBusinessById);
router.use(authMiddleware); 
router.post('/setup-business', businessController.setupBusiness);
router.post('/send-otp', businessController.sendOtp);
router.post('/verify-otp', businessController.verifyOtp);
router.get('/get-business-by-owner', businessController.getBusinessByOwner);
// router.get('/get-available-slots/:serviceId', businessController.getAvaliableSlots);

export default router;