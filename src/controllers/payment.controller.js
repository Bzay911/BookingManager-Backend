import prisma from "../lib/prisma.js";
import stripe from "../lib/stripe.js";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const paymentContoller = {
  // async createPaymentIntent(req, res) {
  //   const { bookingId, customerId } = req.body;
  //   try {
  //     // Loading booking with its service and price
  //     const booking = await prisma.booking.findUnique({
  //       where: { id: bookingId },
  //       include: { service: true, customer: true },
  //     });

  //     if (!booking) {
  //       return res.status(404).json({ error: "Booking not found" });
  //     }

  //     // Get or create strip customer
  //     let stripeCustomerId = booking.customer.stripeCustomerId;
  //     if (!stripeCustomerId) {
  //       const stripCustomer = await stripe.customers.create({
  //         phone: booking.customer.phoneNumber,
  //         metadata: { userId: String(booking.customer.id) },
  //       });

  //       stripeCustomerId = stripCustomer.id;

  //       await prisma.user.update({
  //         where: { id: customerId },
  //         data: { stripeCustomerId },
  //       });
  //     }

  //     const amountInCents = Math.round(booking.service.price * 100);

  //     const paymentIntent = await stripe.paymentIntents.create({
  //       amount: amountInCents,
  //       currency: "aud",
  //       customer: stripeCustomerId,
  //       metadata: {
  //         bookingId: String(bookingId),
  //         customerId: String(customerId),
  //         type: "BOOKING",
  //       },
  //     });

  //     await prisma.$transaction([
  //       prisma.payment.create({
  //         data: {
  //           stripePaymentIntentId: paymentIntent.id,
  //           amount: booking.service.price,
  //           currency: "aud",
  //           status: "PENDING",
  //           type: "BOOKING",
  //           bookingId: booking.id,
  //           businessId: booking.businessId,
  //         },
  //       }),
  //       prisma.booking.update({
  //         where: { id: bookingId },
  //         data: { stripePaymentIntentId: paymentIntent.id },
  //       }),
  //     ]);

  //     res.json({ clientSecret: paymentIntent.client_secret });
  //   } catch (err) {
  //     console.error(err);
  //     res.status(500).json({ error: err.message });
  //   }
  // },

    async handleStripeWebhook(req, res) {
      console.log('trigerred webhook');
    const sig = req.headers["stripe-signature"];
      console.log('secret', process.env.STRIPE_WEBHOOK_SECRET);
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,        // ✅ this is raw buffer because of the route middleware
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // idempotency check
    const alreadyProcessed = await prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId: event.id },
    });

    console.log('Stripe webhook event found', alreadyProcessed);
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
          console.log('session completed here is the data', session);

          const { bookingId, customerId, type } = session.metadata;

          if (type === "BOOKING") {
            const booking = await prisma.booking.findUnique({
              where: { id: Number(bookingId) },
            });

            // const lastQueueEntry = await prisma.queueEntry.findFirst({
            //   where:   { businessId: booking.businessId },
            //   orderBy: { position: "desc" },
            // });
            // const nextPosition = lastQueueEntry ? lastQueueEntry.position + 1 : 1;

            await prisma.$transaction([
              prisma.payment.update({
                where: { bookingId: Number(bookingId) },
                data: {
                  status:  "SUCCEEDED",
                  stripePaymentIntentId: session.payment_intent,
                },
              }),
              prisma.booking.update({
                where: { id: Number(bookingId) },
                data:  { status: "COMPLETED" },
              }),
              // prisma.queueEntry.create({
              //   data: {
              //     position:   nextPosition,
              //     status:     "WAITING",
              //     bookingId:  Number(bookingId),
              //     businessId: booking.businessId,
              //   },
              // }),
            ]);

            const customer = await prisma.user.findUnique({
              where: { id: Number(customerId) },
            });

            await twilioClient.messages.create({
              from: "whatsapp:+14155238886",
              to:   `whatsapp:${customer.phoneNumber}`,
              // body: `Your booking is confirmed! You are number ${nextPosition} in the queue. See you soon.`,
              body: `Your booking is confirmed! You are number in the queue. See you soon.`,
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
