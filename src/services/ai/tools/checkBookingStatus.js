import { tool } from "ai";
import { z } from "zod";
import prisma from "../../../lib/prisma.js";

export const checkBookingStatusTool = (business, customer) =>
	tool({
		description:
			"Checks the customer's latest booking status for this business, including payment state when available.",
		inputSchema: z.object({
			bookingId: z
				.number()
				.int()
				.optional()
				.describe("Optional booking ID if the customer is asking about a specific booking."),
		}),
		execute: async ({ bookingId }) => {
			console.log("🔧 checkBookingStatusTool executed");

			if (!business?.id || !customer?.id) {
				return {
					ok: false,
					code: "MISSING_CONTEXT",
					message: "Missing business or customer context.",
				};
			}

			try {
				const booking = await prisma.booking.findFirst({
					where: {
						...(bookingId ? { id: bookingId } : {}),
						businessId: business.id,
						customerId: customer.id,
					},
					orderBy: bookingId ? undefined : { scheduledAt: "desc" },
					include: {
						service: {
							select: {
								id: true,
								service: true,
							},
						},
						payment: {
							select: {
								status: true,
							},
						},
					},
				});

				if (!booking) {
					return {
						ok: false,
						code: "BOOKING_NOT_FOUND",
						message: bookingId
							? "No booking was found with that ID for this customer."
							: "No booking was found for this customer at this business.",
					};
				}

				return {
					ok: true,
					code: "BOOKING_STATUS_FOUND",
					booking: {
						bookingId: booking.id,
						serviceId: booking.serviceId,
						serviceName: booking.service?.service ?? null,
						scheduledAt: booking.scheduledAt.toISOString(),
						bookingStatus: booking.status,
						paymentStatus: booking.payment?.status ?? null,
						updatedAt: booking.updatedAt.toISOString(),
					},
				};
			} catch (error) {
				console.error("Failed to check booking status:", error.message);
				return {
					ok: false,
					code: "BOOKING_STATUS_CHECK_FAILED",
					message: "Could not check booking status right now.",
				};
			}
		},
	});
