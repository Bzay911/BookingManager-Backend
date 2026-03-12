import { Router } from "express";
import  {authController}  from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();
router.post('/google-login', authController.googleLogin);

router.use(authMiddleware); 
router.patch('/update-role', authController.updateRole);

export default router;