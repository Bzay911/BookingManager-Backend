import parseBookingSignal from "./ParseBookingSignal.js";
import prisma from "../src/lib/prisma.js";
import stripe from "../src/lib/stripe.js";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function getOrCreateStripeCustomer(customer) {
  if (customer.stripeCustomerId) return customer.stripeCustomerId;

  const stripeCustomer = await stripe.customers.create({
    phone: customer.phoneNumber,
    metadata: { userId: String(customer.id) },
  });

  await prisma.user.update({
    where: { id: customer.id },
    data:  { stripeCustomerId: stripeCustomer.id },
  });

  return stripeCustomer.id;
};

async function createBooking(replyMessage, customer, businessId) {
  // 1. Parse the booking signal from AI reply — bail if none
  const bookingSignal = parseBookingSignal(replyMessage);
  if (!bookingSignal) return;

  try {
    // 2. Load service so we have the price + business name
    const service = await prisma.service.findUnique({
      where: { id: bookingSignal.serviceId },
      include: { business: true },
    });

    if (!service) {
      console.error("Service not found:", bookingSignal.serviceId);
      return;
    }

    // 3. Create booking with PENDING status
    const booking = await prisma.booking.create({
      data: {
        customerId:  customer.id,
        businessId,
        serviceId:   bookingSignal.serviceId,
        scheduledAt: bookingSignal.scheduledAt,
        status:      "PENDING",
      },
    });
    console.log("Booking created:", booking.id);

    // 4. Get or create Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(customer);

    // 5. Create Stripe Payment Link
    const amountInCents = Math.round(service.price * 100);

   const paymentLink = await stripe.paymentLinks.create({
  line_items: [
    {
      price_data: {
        currency:    "aud",
        unit_amount: amountInCents,
        product_data: {
          name:        `${service.service} at ${service.business.businessName}`,
          description: `Appointment on ${new Date(bookingSignal.scheduledAt).toDateString()}`,
        },
      },
      quantity: 1,
    },
  ],
  restrictions:{
    completed_sessions: {limit: 1} // one payment only, then the link deactivates
  },
  payment_intent_data: {
    setup_future_usage: 'off_session' // saves card for future charges
  },
  metadata: {
    bookingId:  String(booking.id),
    customerId: String(customer.id),
    type:       "BOOKING",
  },
});

    console.log("Payment link created:", paymentLink.url);

    // 6. Save Payment record in DB
    await prisma.payment.create({
      data: {
        stripePaymentIntentId: paymentLink.id, // real PI id will come via webhook
        amount:     service.price,
        currency:   "aud",
        status:     "PENDING",
        type:       "BOOKING",
        bookingId:  booking.id,
        businessId,
      },
    });

    // 7. Send payment link to customer via WhatsApp
    await twilioClient.messages.create({
      from: "whatsapp:+14155238886",
      to:   `whatsapp:${customer.phoneNumber}`,
      body: `Great! Your booking is almost confirmed.\n\nTap here to complete your payment:\n${paymentLink.url}`,
    });

    console.log("Payment link sent to:", customer.phoneNumber);

  } catch (error) {
    console.error("Failed to create booking:", error.message);
  }
}

export default createBooking;