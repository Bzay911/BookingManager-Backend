import prisma from "../lib/prisma.js";
import twilio from "twilio";
import { generateReply } from "../services/ai/generateReply.js";
import fetchAIContext from "../utils/FetchAiContext.js";
import updateCustomerName from "../utils/UpdateCustomerName.js";
import findOrCreateCustomer from "../utils/FindOrCreateCustomer.js";
import sendReply from "../utils/SendReply.js";

const { MessagingResponse } = twilio.twiml;

async function extractBusinessId(incomingMessage, phoneNumber) {
  const businessIdMatch = incomingMessage.match(/BUSINESS:(\d+)/);

  if (businessIdMatch) {
    return parseInt(businessIdMatch[1]);
  }

  const lastConvo = await prisma.conversation.findFirst({
    where: { customerPhone: phoneNumber },
    orderBy: { createdAt: "desc" },
  });

  return lastConvo?.businessId ?? null;
}

export const bookingController = {
  async handleIncomingMessage(req, res) {
    const incomingMessage = req.body.Body;
    const customerPhone = req.body.From;
    const phoneNumber = customerPhone.replace("whatsapp:", "");
    const businessId = await extractBusinessId(incomingMessage, phoneNumber);

    let customer = await findOrCreateCustomer(phoneNumber);

    await prisma.conversation.create({
      data: {
        customerPhone: phoneNumber,
        businessId,
        role: "user",
        content: incomingMessage,
      },
    });

    const { history, business } = await fetchAIContext(phoneNumber, businessId);

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

    await prisma.conversation.create({
      data: {
        customerPhone: phoneNumber,
        businessId,
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
