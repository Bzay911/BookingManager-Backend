import { tool } from "ai";
import { z } from "zod";
import createBooking from "../createBooking.js";

export const createBookingTool = (business, customer) =>
  tool({
    description:
      "Creates a booking when the customer confirms the service and time they want.",
    parameters: z.object({
      serviceId: z.number().int().describe("The ID of the service to book"),
      scheduledAt: z.string().describe("ISO datetime e.g. 2026-03-25T15:00:00"),
    }),
    execute: async ({ serviceId, scheduledAt }) => {
      if (!serviceId || !scheduledAt) {
        console.warn("create_booking tool called with incomplete args:", {
          serviceId,
          scheduledAt,
        });
        return {
          ok: false,
          code: "INCOMPLETE_ARGS",
          message: "Service ID and scheduled time are required.",
        };
      }
      const result = await createBooking(
        { serviceId, scheduledAt },
        customer,
        business.id,
      );
      return result;
    },
  });
