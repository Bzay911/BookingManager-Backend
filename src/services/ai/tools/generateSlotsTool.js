import { tool } from "ai";
import { z } from "zod";
import prisma from "../../../lib/prisma.js";
import getStartAndEndOfDay from "../../../utils/getStartAndEndOfDay.js";
import generateSlots from "../../slot/generateSlots.js";
import filterAvailableSlots from "../../slot/filterAvailableSlots.js";

export const generateTimeslotsTool = (business) => tool({
        description:
        "Checks availability for a service at a requested datetime and returns future available slots.",
      parameters: z.object({
        serviceId: z.number().int().describe("The ID of the service"),
        scheduledAt: z
          .string()
          .describe("ISO datetime e.g. 2026-03-25T15:00:00"),
      }),
      execute: async ({ serviceId, scheduledAt }) => {
        if (!serviceId || !scheduledAt) {
          return {
            ok: false,
            code: "INCOMPLETE_ARGS",
            message: "Service ID and date are required.",
          };
        }

        const requestedDateTime = new Date(scheduledAt);
        if (Number.isNaN(requestedDateTime.getTime())) {
          return {
            ok: false,
            code: "INVALID_DATETIME",
            message: "Invalid datetime format. Use ISO datetime.",
          };
        }

        const service = business.services.find((s) => s.id === serviceId);
        if (!service) {
          return {
            ok: false,
            code: "SERVICE_NOT_FOUND",
            message: "We could not find that service.",
          };
        }

        const { dayStart, dayEnd } = getStartAndEndOfDay(requestedDateTime);

        const slots = generateSlots(
          business.openingTime,
          business.closingTime,
          service.durationMinutes,
          requestedDateTime,
        );

        const bookings = await prisma.booking.findMany({
          where: {
            businessId: business.id,
            status: { not: "CANCELLED" },
            scheduledAt: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
          include: {
            service: {
              select: {
                durationMinutes: true,
              },
            },
          },
        });

        const availableSlots = filterAvailableSlots(
          slots,
          bookings,
          requestedDateTime,
        ).map((slot) => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          label: slot.label,
        }));


        return {
          ok: true,
          code: "SLOTS_GENERATED",
          slots: availableSlots,
        };
      },
})