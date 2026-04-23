import { tool } from "ai";
import { z } from "zod";
import createBooking from "../createBooking.js";

export function toolsDispatcher({ customer, business }) {
  return {
    create_booking: tool({
      description:
        "Creates a booking when the customer confirms the service and time they want.",
      parameters: z.object({
        serviceId: z.number().int().describe("The ID of the service to book"),
        scheduledAt: z
          .string()
          .describe("ISO datetime e.g. 2026-03-25T15:00:00"),
      }),
      execute: async ({ serviceId, scheduledAt }) => {
        await createBooking({ serviceId, scheduledAt }, customer, business.id);
        return { success: true };
      },
    }),
  };
};
