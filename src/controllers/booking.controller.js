import prisma from "../lib/prisma.js";
import twilio from "twilio";

const { MessagingResponse } = twilio.twiml;

export const bookingController = {
  async handleIncomingMessage(req, res) {
    const incomingMessage = req.body.Body;
    const customerPhoneNumber = req.body.From;
    const toNumber = req.body.To;

    console.log(`Message from ${customerPhone}: ${incomingMessage}`);

    // Extracting business id from the first message
    // Message looks like: "BUSINESS:3 Hi I want to book"
    const businessIdMatch = incomingMessage.match(/BUSINESS:(\d+)/);

    let businessId;
    if(businessIdMatch){
        businessId = parseInt(businessIdMatch[1]);
        await prisma
    }

  },
};
