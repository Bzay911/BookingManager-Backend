import prisma from "../lib/prisma.js";
import twilio from "twilio";
import { generateReply } from "../../services/ai.service.js";
import fetchAIContext from "../../utils/FetchAiContext.js";
import updateCustomerName from "../../utils/UpdateCustomerName.js";
import createBooking from "../../utils/CreateBooking.js";

const { MessagingResponse } = twilio.twiml;
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

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
};

async function findOrCreateCustomer(phoneNumber) {
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

  return customer;
};

function stripBookingSignal(replyMessage) {
  // we are only sending the friendly message to customer 
  return replyMessage.replace(/CONFIRM_BOOKING:[^\n]+\n?/, "").trim();
};

async function sendReply(customerPhone, phoneNumber, businessId, cleanReply) {
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

export const bookingController = {
  async handleIncomingMessage(req, res) {
    const incomingMessage = req.body.Body;
    const customerPhone = req.body.From;
    const phoneNumber = customerPhone.replace("whatsapp:", "");

    // 1. figure out which business
    const businessId = await extractBusinessId(incomingMessage, phoneNumber);

    // 2. who is texting
    let customer = await findOrCreateCustomer(phoneNumber);

    // 3. save incoming message to DB
    await prisma.conversation.create({
      data: {
        customerPhone: phoneNumber,
        businessId,
        role: "user",
        content: incomingMessage,
      },
    });

    // 4. fetch context for AI
    const { history, business } = await fetchAIContext(phoneNumber, businessId);

    // 5. check if customer just provided their name
    customer = await updateCustomerName(customer, history, incomingMessage, phoneNumber);

    // 6. generate AI reply
    const replyMessage = await generateReply({
      history,
      business,
      incomingMessage,
      customer,
    });

    // 7. create booking if signal detected
    await createBooking(replyMessage, customer, businessId);

    // 8. strip signal and send clean reply
    const cleanReply = stripBookingSignal(replyMessage);
    await sendReply(customerPhone, phoneNumber, businessId, cleanReply);

    // 9. acknowledge twilio webhook
    const twiml = new MessagingResponse();
    return res.type("text/xml").send(twiml.toString());
  },

  async getBookings(req, res){
    const userId = req.user.id;
    const business = await prisma.business.findFirst({
      where: { ownerId: userId },
    });

    if(!business){
      return res.status(404).json({error: "Business not found for this user"});
    }

    // const businessId = parseInt(req.params.businessId);
    // console.log('received business id for fech booking', businessId);

    try{
      const bookings = await prisma.booking.findMany({
        where: {businessId: business.id},
        include:{
          customer: true,
          service: true
        }
      });

      console.log("Fetched bookings for business id", bookings);

      if(!bookings){
        console.log("No bookings found for buiness id", business.id);
        return res.status(404).json({error: "No bookings found for this business"});
      }

      return res.json(bookings);
    } catch (error) {
      console.error("Failed to fetch bookings:", error.message);
      return res.status(500).json({ error: "Failed to fetch bookings" });
    }

  }

};