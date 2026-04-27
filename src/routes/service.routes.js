import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { serviceController } from "../controllers/service.controller.js";

const router = Router();

router.use(authMiddleware); 
router.get('/get-all-services', serviceController.getServices); 
router.post('/add-service', serviceController.addService);

export default router;