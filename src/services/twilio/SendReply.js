import { client } from "./twilio.js";

async function sendReply(customerPhone, phoneNumber, businessId, cleanReply) {
console.log("Sending reply to:", customerPhone);
  try {
    await client.messages.create({
      from: "whatsapp:+14155238886", // gurungbeejaya@gmail.com
      to: customerPhone,
      body: cleanReply,
    });
  } catch (error) {
    console.error("Failed to send reply:", error.message);
  }
};

export default sendReply;