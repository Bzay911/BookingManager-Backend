import prisma from "../lib/prisma.js";
import twilio from "twilio";

const { MessagingResponse } = twilio.twiml;
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export const bookingController = {
  async handleIncomingMessage(req, res) {
    const incomingMessage = req.body.Body;
    const customerPhone = req.body.From; // whatsapp:+61412345678
    const phoneNumber = customerPhone.replace('whatsapp:', '');

    console.log('📱 Message received from:', phoneNumber);
    console.log('Message:', incomingMessage);

    // Save message to database
    let businessId = null;
    const businessIdMatch = incomingMessage.match(/BUSINESS:(\d+)/);

    if (businessIdMatch) {
      businessId = parseInt(businessIdMatch[1]);
    } else {
      const lastConvo = await prisma.conversation.findFirst({
        where: { customerPhone: phoneNumber },
        orderBy: { createdAt: 'desc' }
      });
      businessId = lastConvo?.businessId;
    }

    await prisma.conversation.create({
      data: {
        customerPhone: phoneNumber,
        businessId,
        role: 'user',
        content: incomingMessage,
      }
    });

    console.log('✅ Message saved to database');

    // ===== NOW SEND A REPLY =====
    
    // Option 1: Send a simple auto-reply
    const replyMessage = "Thanks for your message! We'll get back to you shortly.";
    
    try {
      await client.messages.create({
        from: 'whatsapp:+1234567890', // Your Twilio WhatsApp number
        to: customerPhone,
        body: replyMessage
      });
      
      console.log('✅ Reply sent!');
      
      // Also save the reply to database
      await prisma.conversation.create({
        data: {
          customerPhone: phoneNumber,
          businessId,
          role: 'assistant',
          content: replyMessage,
        }
      });
    } catch (error) {
      console.error('❌ Failed to send reply:', error.message);
    }

    // Respond to Twilio webhook
    const twiml = new MessagingResponse();
    return res.type('text/xml').send(twiml.toString());
  }
};