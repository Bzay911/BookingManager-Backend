import { SchemaType } from "@google/generative-ai";

// Gemini Tool Definition
const createBookingToolGemini = {
  name: "create_booking",
  description:
    "Creates a booking when the customer confirms the service and time they want.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      serviceId: {
        type: SchemaType.INTEGER,
        description: "The ID of the service the customer wants to book.",
      },
      scheduledAt: {
        type: SchemaType.STRING,
        description:
          "The ISO date string of when the appointment is scheduled (e.g., '2026-03-25T15:00:00').",
      },
    },
    required: ["serviceId", "scheduledAt"],
  },
};

export default createBookingToolGemini;