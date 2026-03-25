import prisma from "../lib/prisma.js";
import twilio from "twilio";
import { generateReply } from "../../services/ai.service.js";
import fetchAIContext from "../../utils/FetchAiContext.js";
import updateCustomerName from "../../utils/UpdateCustomerName.js";
import createBooking from "../../utils/CreateBooking.js";
import findOrCreateCustomer from "../../utils/FindOrCreateCustomer.js";
import sendReply from "../../utils/SendReply.js";

const { MessagingResponse } = twilio.twiml;


// Helper Functions
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

    // figure out which business
    const businessId = await extractBusinessId(incomingMessage, phoneNumber);

    // who is texting
    let customer = await findOrCreateCustomer(phoneNumber);

    // save incoming message to DB
    await prisma.conversation.create({
      data: {
        customerPhone: phoneNumber,
        businessId,
        role: "user",
        content: incomingMessage,
      },
    });

    // fetch context for AI
    const { history, business } = await fetchAIContext(phoneNumber, businessId);

    // check if customer just provided their name
    customer = await updateCustomerName(
      customer,
      history,
      incomingMessage,
      phoneNumber,
    );

    const aiResponse = await generateReply({
      history,
      business,
      incomingMessage,
      customer,
    });

    if (aiResponse.type === "TOOL_CALL") {
      console.log("Ai trigerred the booking tool! Executing db logic");

      await createBooking(aiResponse.args, customer, businessId);
      await sendReply(
        customerPhone,
        phoneNumber,
        businessId,
        "Booking initiated! Generating your payment link...",
      );
    } else {
      console.log("AI just sent a text response.");
      await sendReply(
        customerPhone,
        phoneNumber,
        businessId,
        aiResponse.content,
      );
    }
    // 9. acknowledge twilio webhook
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

      console.log("Fetched bookings for business id", bookings);

      if (!bookings) {
        console.log("No bookings found for buiness id", business.id);
        return res
          .status(404)
          .json({ error: "No bookings found for this business" });
      }

      return res.json(bookings);
    } catch (error) {
      console.error("Failed to fetch bookings:", error.message);
      return res.status(500).json({ error: "Failed to fetch bookings" });
    }
  },
};
