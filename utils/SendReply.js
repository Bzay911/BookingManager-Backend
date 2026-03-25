import twilio from "twilio";
import prisma from "../src/lib/prisma.js";

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

    await prisma.conversation.create({
      data: {
        customerPhone: phoneNumber,
        businessId,
        role: "assistant",
        content: cleanReply,
      },
    });

    console.log("Reply sent successfully");
  } catch (error) {
    console.error("Failed to send reply:", error.message);
  }
};

export default sendReply;