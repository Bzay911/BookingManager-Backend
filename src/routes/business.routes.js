import { Router } from "express";
import  {businessController}  from "../controllers/business.controller.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(authMiddleware); 
router.get('/get-all-businesses', businessController.getAllBusinesses);
router.get('/get-business/:id', businessController.fetchBusinessById);
router.post('/setup-business', businessController.setupBusiness);
router.post('/send-otp', businessController.sendOtp);
router.post('/verify-otp', businessController.verifyOtp);

export default router;