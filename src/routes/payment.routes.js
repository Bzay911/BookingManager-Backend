import { Router } from "express";
// import { authMiddleware } from "../middlewares/authMiddleware.js";
import { paymentContoller } from "../controllers/payment.controller.js";
import express from "express";

const router = Router();

// router.use(authMiddleware);
router.post(
  "/handle-stripe-webhook",
  express.raw({ type: "application/json" }), paymentContoller.handleStripeWebhook);

export default router;
