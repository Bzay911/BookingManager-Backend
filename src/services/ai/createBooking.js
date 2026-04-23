import prisma from "../../lib/prisma.js";
import stripe from "../../lib/stripe.js";
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
    data: { stripeCustomerId: stripeCustomer.id },
  });

  return stripeCustomer.id;
};

async function createBooking(bookingArgs, customer, businessId) {
  try {
    // Load service so we have the price + business name
    const service = await prisma.service.findUnique({
      where: { id: bookingArgs.serviceId },
      include: { business: true },
    });

    if (!service) {
      console.error("Service not found:", bookingArgs.serviceId);
      return;
    }

    // Create booking with PENDING status
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        businessId,
        serviceId: bookingArgs.serviceId,
        scheduledAt: new Date(bookingArgs.scheduledAt),
        status: "PENDING",
      },
    });

    // Get or create Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(customer);

    // Create Stripe Payment Link
    const amountInCents = Math.round(service.price * 100);

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: "aud",
            unit_amount: amountInCents,
            product_data: {
              name: `${service.service} at ${service.business.businessName}`,
              description: `Appointment on ${new Date(bookingArgs.scheduledAt).toDateString()}`,
            },
          },
          quantity: 1,
        },
      ],
      restrictions: {
        completed_sessions: { limit: 1 } // one payment only, then the link deactivates
      },
      payment_intent_data: {
        setup_future_usage: 'off_session' // saves card for future charges
      },
      metadata: {
        bookingId: String(booking.id),
        customerId: String(customer.id),
        type: "BOOKING",
      },
    });

    // Save Payment record in DB
    await prisma.payment.create({
      data: {
        stripePaymentIntentId: paymentLink.id, // real PI id will come via webhook
        amount: service.price,
        currency: "aud",
        status: "PENDING",
        type: "BOOKING",
        bookingId: booking.id,
        businessId,
      },
    });

    //  Send payment link to customer via WhatsApp
    await twilioClient.messages.create({
      from: "whatsapp:+14155238886",
      to: `whatsapp:${customer.phoneNumber}`,
      body: `Great! Your booking is almost confirmed.\n\nTap here to complete your payment:\n${paymentLink.url}`,
    });


  } catch (error) {
    console.error("Failed to create booking:", error.message);
  }
}

export default createBooking;