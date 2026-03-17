import prisma from "../lib/prisma.js";
import twilio from "twilio";

const { MessagingResponse } = twilio.twiml;

export const bookingController = {
  async handleIncomingMessage(req, res) {
    const incomingMessage = req.body.Body;
    const customerPhone = req.body.From; // whatsapp:+61412345678

    console.log('=== NEW WHATSAPP MESSAGE ===');
    console.log('From:', customerPhone);
    console.log('Message:', incomingMessage);
    console.log('===========================');

    // Extract business ID if first message
    const businessIdMatch = incomingMessage.match(/BUSINESS:(\d+)/);

    if (businessIdMatch) {
      const businessId = parseInt(businessIdMatch[1]);

      // Save to DB so we know context
      await prisma.conversation.create({
        data: {
          customerPhone: customerPhone.replace('whatsapp:', ''),
          businessId,
          role: 'user',
          content: incomingMessage,
        }
      });

      console.log(`Linked to business ID: ${businessId}`);
    } else {
      // Just save message to history
      const lastConvo = await prisma.conversation.findFirst({
        where: { customerPhone: customerPhone.replace('whatsapp:', '') },
        orderBy: { createdAt: 'desc' }
      });

      if (lastConvo) {
        await prisma.conversation.create({
          data: {
            customerPhone: customerPhone.replace('whatsapp:', ''),
            businessId: lastConvo.businessId,
            role: 'user',
            content: incomingMessage,
          }
        });
      }
    }

    // Just acknowledge to Twilio — no auto reply yet
    // You reply manually from Twilio Console
    const twiml = new MessagingResponse();
    return res.type('text/xml').send(twiml.toString());
  }
};
