import { Router } from "express";
import  {authController}  from "../controllers/auth.controller.js";

const router = Router();
router.post('/google-login', authController.googleLogin);

export default router;