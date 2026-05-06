import { Worker } from "bullmq";
import twilio from "twilio";
import { connection } from "./queue.js";
import prisma from "./prisma.js"; // your DB client

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

const worker = new Worker(
  "booking-reminders",
  async (job) => {
    const { bookingId } = job.data;

    // Fetch booking details from DB
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, service: true },
    });

    console.log("Processing job for booking ID:", bookingId);

    if (!booking) {
      console.error(`Booking with ID ${bookingId} not found.`);
      return;
    }

    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${booking.customer.phone}`,
      body: `Hi ${booking.customer.name}! 👋 Your booking *${booking.service.name}* starts in 15 minutes. See you soon!`,
    });
  },
  {
    connection,
  },
);

worker.on("completed", (job) => {
  console.log(`Job with ID ${job.id} has been completed.`);
});

worker.on("failed", (job, err) => {
  console.error(`Job with ID ${job.id} failed with error:`, err);
});

export default worker;
