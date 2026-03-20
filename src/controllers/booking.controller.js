import prisma from "../lib/prisma.js";
import twilio from "twilio";
import { generateReply } from "../../services/ai.service.js";

const { MessagingResponse } = twilio.twiml;
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

export const bookingController = {
  async handleIncomingMessage(req, res) {
    const incomingMessage = req.body.Body;
    const customerPhone = req.body.From;
    const phoneNumber = customerPhone.replace("whatsapp:", "");

    // Extract businessId
    let businessId = null;
    const businessIdMatch = incomingMessage.match(/BUSINESS:(\d+)/);

    if (businessIdMatch) {
      businessId = parseInt(businessIdMatch[1]);
    } else {
      const lastConvo = await prisma.conversation.findFirst({
        where: { customerPhone: phoneNumber },
        orderBy: { createdAt: "desc" },
      });
      businessId = lastConvo?.businessId;
    }

    // Find or create customer 
    let customer = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!customer) {
      customer = await prisma.user.create({
        data: {
          phoneNumber,
          role: "CUSTOMER",
        },
      });
    }

    // Save incoming message to DB 
    await prisma.conversation.create({
      data: {
        customerPhone: phoneNumber,
        businessId,
        role: "user",
        content: incomingMessage,
      },
    });

    // Fetch history + business in parallel 
    const [history, business] = await Promise.all([
      prisma.conversation.findMany({
        where: { customerPhone: phoneNumber, businessId },
        orderBy: { createdAt: "asc" },
        take: 20,
      }),
      businessId
        ? prisma.business.findUnique({
            where: { id: businessId },
            include: { services: true },
          })
        : null,
    ]);

    // Check if customer just provided their name
    if (!customer.displayName) {
      const lastAssistantMsg = history
        .filter((msg) => msg.role === "assistant")
        .at(-1);

      if (lastAssistantMsg?.content.toLowerCase().includes("name")) {
        // this message is their name — save it
        customer = await prisma.user.update({
          where: { phoneNumber },
          data: { displayName: incomingMessage },
        });
      }
    }

    // Generate AI reply
    const replyMessage = await generateReply({
      history,
      business,
      incomingMessage,
      customer,
    });

    // Send reply via Twilio + save to DB
    try {
      await client.messages.create({
        from: "whatsapp:+14155238886",
        to: customerPhone,
        body: replyMessage,
      });

      await prisma.conversation.create({
        data: {
          customerPhone: phoneNumber,
          businessId,
          role: "assistant",
          content: replyMessage,
        },
      });
    } catch (error) {
      console.error("Failed to send reply:", error.message);
    }

    // Respond to Twilio webhook
    const twiml = new MessagingResponse();
    return res.type("text/xml").send(twiml.toString());
  },
};