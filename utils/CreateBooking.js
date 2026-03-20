import parseBookingSignal from "./ParseBookingSignal.js";
import prisma from "../src/lib/prisma.js";

async function createBooking(replyMessage, customer, businessId) {
  const bookingSignal = parseBookingSignal(replyMessage);
  if (!bookingSignal) return;

  try {
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        businessId,
        serviceId: bookingSignal.serviceId,
        scheduledAt: bookingSignal.scheduledAt,
        status: "PENDING",
      },
    });
    console.log("Booking created:", booking.id);
  } catch (error) {
    console.error("Failed to create booking:", error.message);
  }
};

export default createBooking;   