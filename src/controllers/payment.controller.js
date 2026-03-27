import prisma from "../lib/prisma.js";
import stripe from "../lib/stripe.js";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

export const paymentContoller = {
  async handleStripeWebhook(req, res) {
    console.log("trigerred webhook");
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body, // ✅ this is raw buffer because of the route middleware
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error("Webhook signature failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // idempotency check
    const alreadyProcessed = await prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId: event.id },
    });

    console.log("Stripe webhook event found", alreadyProcessed);
    if (alreadyProcessed) {
      console.log("Duplicate event, skipping:", event.id);
      return res.json({ received: true });
    }

    await prisma.stripeWebhookEvent.create({
      data: { stripeEventId: event.id, type: event.type },
    });

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          console.log("session completed here is the data", session);

          const { bookingId, customerId, type } = session.metadata;

          if (type === "BOOKING") {
            const booking = await prisma.booking.findUnique({
              where: { id: Number(bookingId) },
            });

            const bookingDate = new Date(booking.scheduledAt);

            // start of that day — e.g. 2025-08-10 00:00:00
            const dayStart = new Date(bookingDate);
            dayStart.setHours(0, 0, 0, 0);

            // end of that day — e.g. 2025-08-10 23:59:59
            const dayEnd = new Date(bookingDate);
            dayEnd.setHours(23, 59, 59, 999);

            const lastQueueEntry = await prisma.queueEntry.findFirst({
              where: {
                businessId: booking.businessId,
                status: "WAITING",
                booking: {
                  scheduledAt: { gte: dayStart, lte: dayEnd }
                }
              },
              orderBy: { position: "desc" }
            });

            const nextPosition = lastQueueEntry ? lastQueueEntry.position + 1 : 1;


            await prisma.$transaction([
              prisma.payment.update({
                where: { bookingId: Number(bookingId) },
                data: {
                  status: "PAID",
                  stripePaymentIntentId: session.payment_intent,
                },
              }),
              prisma.booking.update({
                where: { id: Number(bookingId) },
                data: { status: "COMPLETED" },
              }),
              prisma.queueEntry.create({
                data: {
                  position: nextPosition,
                  status: "WAITING",
                  bookingId: Number(bookingId),
                  businessId: booking.businessId,
                },
              }),
            ]);

            const customer = await prisma.user.findUnique({
              where: { id: Number(customerId) },
            });

            await twilioClient.messages.create({
              from: "whatsapp:+14155238886",
              to: `whatsapp:${customer.phoneNumber}`,
              body: `Your booking is confirmed! You are number ${nextPosition} in the queue. See you soon.`,
            });

            console.log("Booking confirmed:", bookingId);
          }
          break;
        }

        case "checkout.session.expired": {
          const session = event.data.object;
          const { bookingId } = session.metadata;

          await prisma.$transaction([
            prisma.payment.deleteMany({
              where: { bookingId: Number(bookingId) },
            }),
            prisma.booking.delete({
              where: { id: Number(bookingId) },
            }),
          ]);

          console.log("Booking expired and removed:", bookingId);
          break;
        }

        default:
          console.log("Unhandled event:", event.type);
      }
    } catch (err) {
      console.error("Webhook handler error:", err.message);
      return res.status(500).json({ error: "Handler failed" });
    }

    res.json({ received: true });
  },
};
