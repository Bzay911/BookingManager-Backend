import twilio from "twilio";
import prisma from "../lib/prisma.js";

async function sendReply(customerPhone, phoneNumber, businessId, cleanReply) {

    const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

  try {
    await client.messages.create({
      from: "whatsapp:+14155238886",
      to: customerPhone,
      body: cleanReply,
    });
  } catch (error) {
    console.error("Failed to send reply:", error.message);
  }
};

export default sendReply;