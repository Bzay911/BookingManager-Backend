import { client } from "./twilio.js";  

export async function sendTypingIndicator(incomingMessageSid) {
  if (!incomingMessageSid) return;
  try {
    await client.messaging.v2.typingIndicator.create({
      messageId: incomingMessageSid,
      channel: "whatsapp",
    });
  } catch (error) {
    console.error("Failed to send typing indicator:", error.message);
  }
}