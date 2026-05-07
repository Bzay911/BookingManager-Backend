import prisma from "../lib/prisma.js";
import twilio from "twilio";
import { generateReply } from "../services/ai/generateReply.js";
import updateCustomerName from "../utils/UpdateCustomerName.js";
import findOrCreateCustomer from "../utils/FindOrCreateCustomer.js";
import sendReply from "../services/twilio/SendReply.js";
import { sendTypingIndicator } from "../services/twilio/sendTypingIndicator.js";
import findOrCreateConversation from "../utils/FindOrCreateConversation.js";

const { MessagingResponse } = twilio.twiml;

async function extractBusinessId(incomingMessage, phoneNumber) {
  const businessIdMatch = incomingMessage.match(/BUSINESS:(\d+)/);

  if (businessIdMatch) {
    return parseInt(businessIdMatch[1]);
  }

  const lastConvo = await prisma.conversation.findFirst({
    where: { customerPhone: phoneNumber, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  return lastConvo?.businessId ?? null;
}

async function fetchBusiness(businessId) {
  if (!businessId) return null;

  return prisma.business.findUnique({
    where: { id: businessId },
    include: { services: true },
  });
}

export const bookingController = {
  async handleIncomingMessage(req, res) {
    const incomingMessage = req.body.Body;
    const customerPhone = req.body.From;
    const phoneNumber = customerPhone.replace("whatsapp:", "");
    const businessId = await extractBusinessId(incomingMessage, phoneNumber);
    const incomingMessageSid = req.body.MessageSid;

    let customer = await findOrCreateCustomer(phoneNumber);

    const conversation = await findOrCreateConversation(
      phoneNumber,
      businessId,
    );

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: incomingMessage,
      },
    });

    // re-fetch messages after saving so history is always complete and in order
    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });

    const business = await fetchBusiness(businessId);

    const history = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // console.log("Conversation history:", history);

    // got the message, now send the typing indicator while we process the AI response
    // await sendTypingIndicator(incomingMessageSid);

    if (!customer.displayName) {
      customer = await updateCustomerName(
        customer,
        history,
        incomingMessage,
        phoneNumber,
      );
    }

    const aiResponse = await generateReply({
      history,
      business,
      incomingMessage,
      customer,
    });

    console.log("AI response:", aiResponse);

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: aiResponse.content,
      },
    });

    await sendReply(customerPhone, phoneNumber, businessId, aiResponse.content);

    const twiml = new MessagingResponse();
    return res.type("text/xml").send(twiml.toString());
  },

  async getBookings(req, res) {
    const userId = req.user.id;
    const business = await prisma.business.findFirst({
      where: { ownerId: userId },
    });

    if (!business) {
      return res
        .status(404)
        .json({ error: "Business not found for this user" });
    }

    try {
      const bookings = await prisma.booking.findMany({
        where: { businessId: business.id },
        include: {
          customer: true,
          service: true,
        },
      });

      console.log("bookings", bookings);
      if (!bookings.length) {
        return res
          .status(404)
          .json({ error: "No bookings found for this business" });
      }

      return res.json(bookings);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch bookings" });
    }
  },
};
