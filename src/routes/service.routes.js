import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { serviceController } from "../controllers/service.controller.js";

const router = Router();

router.use(authMiddleware); 
router.get('/get-all-services', serviceController.getServices); 

export default router;