import { client } from "./twilio.js";

async function sendReply(customerPhone, phoneNumber, businessId, cleanReply) {

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