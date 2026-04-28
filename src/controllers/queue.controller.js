import prisma from "../lib/prisma.js";
import generateSlots from "../services/slot/generateSlots.js";
import filterAvailableSlots from "../services/slot/filterAvailableSlots.js";
import getStartAndEndOfDay from "../utils/getStartAndEndOfDay.js";
// import { getIO } from "../socket/socket.js";

export const queueController = {
  async getLiveQueue(req, res) {
    try {
      const userId = req.user.id;
      const business = await prisma.business.findFirst({
        where: { ownerId: userId },
      });

      if (!business) {
        return res
          .status(404)
          .json({ error: "Business not found for this user" });
      }

      // today's date range
      const { dayStart: todayStart, dayEnd: todayEnd } =
        getStartAndEndOfDay(new Date());

      const liveQueue = await prisma.queueEntry.findMany({
        where: {
          businessId: business.id,
          status: { not: "DONE" }, // exclude finished entries
          booking: {
            scheduledAt: {
              gte: todayStart, // from midnight
              lte: todayEnd, // to end of day
            },
          },
        },
        include: {
          booking: {
            include: {
              customer: {
                select: {
                  displayName: true,
                  phoneNumber: true,
                },
              },
              service: {
                select: {
                  service: true,
                  durationMinutes: true,
                  price: true,
                },
              },
            },
          },
        },
        orderBy: { position: "asc" }, // position 1 at the top
      });

      console.log("live queue:", liveQueue);
      return res.json(liveQueue);
    } catch (err) {
      console.error("Error fetching live queue", err);
      res.status(500).json({ error: "Failed to fetch live queue" });
    }
  },

  async getAvaliableSlots(req, res) {
    try {
      const userId = req.user.id;
      const { serviceId } = req.params;
      const { date } = req.query;

      const targetDate = date ? new Date(date) : new Date();
      if (Number.isNaN(targetDate.getTime())) {
        return res
          .status(400)
          .json({ error: "Invalid date format. Use YYYY-MM-DD." });
      }

      const { dayStart, dayEnd } = getStartAndEndOfDay(targetDate);

      const business = await prisma.business.findUnique({
        where: { ownerId: userId },
        include: { services: true },
      });

      if (!business) {
        console.log(`Business not found`);
        return res.status(404).json({ error: "Business not found" });
      }
      console.log(`Fetched business`, business);

      const service = business.services.find(
        (s) => s.id === parseInt(serviceId),
      );

      if (!service) {
        console.log(`Service with ID ${serviceId} not found`);
        return res.status(404).json({ error: "Service not found" });
      }

      const [openHour, openMin] = business.openingTime.split(":").map(Number);
      const [closeHour, closeMin] = business.closingTime.split(":").map(Number);

      const openAt = new Date(targetDate);
      openAt.setHours(openHour, openMin, 0, 0);

      const closeAt = new Date(targetDate);
      closeAt.setHours(closeHour, closeMin, 0, 0);

      const now = new Date();
      // dayStart is what the function returns and we are setting it to todayStart
      const { dayStart: todayStart } = getStartAndEndOfDay(now);
      const isToday = dayStart.getTime() === todayStart.getTime();

      let businessStatus = "open";
      let statusMessage = "Business is open for bookings.";

      if (isToday && now < openAt) {
        businessStatus = "not_open_yet";
        statusMessage = `Business opens at ${business.openingTime}.`;
      } else if (isToday && now >= closeAt) {
        businessStatus = "closed";
        statusMessage = `Business closed at ${business.closingTime}.`;
      }

      const slots = generateSlots(
        business.openingTime,
        business.closingTime,
        service.durationMinutes,
        targetDate,
      );

      console.log("Generated actual slots:", slots);

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

      if (businessStatus === "closed") {
        return res.status(200).json({
          status: businessStatus,
          message: statusMessage,
          slots: [],
        });
      }

      const fromTime = isToday ? now : dayStart;

      const availableSlots = filterAvailableSlots(slots, bookings, fromTime);

      console.log("Available slots:", availableSlots);

      res.status(200).json({
        status: businessStatus,
        message: statusMessage,
        slots: availableSlots,
      });
    } catch (error) {
      console.error(
        `Error fetching available slots for business ID ${req.params.id}:`,
        error,
      );
      res.status(500).json({ error: error.message });
    }
  },

  async addWalkins(req, res) {
    try {
      const userId = req.user.id;
      const { customerName, customerPhone, serviceId, scheduledAt } = req.body;
      const scheduledDate = new Date(scheduledAt);

      console.log("Adding walk-in:", {
        customerName,
        customerPhone,
        serviceId,
        scheduledAt,
      });

      // 1. Ensure the business exists
      const business = await prisma.business.findFirst({
        where: { ownerId: userId },
      });

      if (!business) {
        return res.status(404).json({ error: "Business not found" });
      }

      const result = await prisma.$transaction(async (tx) => {
        // 2. Handle Recurring vs New Customer
        // We use the phone number as the unique identifier only when provided.
        const normalizedPhone =
          typeof customerPhone === "string" ? customerPhone.trim() : "";
        const hasPhone = normalizedPhone.length > 0;

        let user = null;
        if (hasPhone) {
          user = await tx.user.findUnique({
            where: { phoneNumber: normalizedPhone },
          });
        }

        if (!user) {
          user = await tx.user.create({
            data: {
              displayName: customerName,
              phoneNumber: hasPhone ? normalizedPhone : null,
              role: "CUSTOMER",
            },
          });
          console.log("New user created:", user.displayName);
        } else {
          console.log("Recurring user found:", user.displayName);
        }

        // 3. Check for double-booking (Optional but recommended)
        const existingBooking = await tx.booking.findFirst({
          where: {
            businessId: business.id,
            scheduledAt: scheduledDate,
            status: { not: "CANCELLED" },
          },
        });

        if (existingBooking) {
          throw new Error("This time slot is already taken.");
        }

        // 4. Create the Booking
        const booking = await tx.booking.create({
          data: {
            businessId: business.id,
            customerId: user.id,
            serviceId: parseInt(serviceId),
            scheduledAt: scheduledDate,
            status: "BOOKED",
          },
        });

        const { dayStart: queueDayStart, dayEnd: queueDayEnd } =
          getStartAndEndOfDay(scheduledDate);

        const lastQueueEntry = await tx.queueEntry.findFirst({
          where: {
            businessId: business.id,
            status: { not: "DONE" },
            booking: {
              scheduledAt: {
                gte: queueDayStart,
                lte: queueDayEnd,
              },
            },
          },
          orderBy: { position: "desc" },
          select: { position: true },
        });

        const nextPosition = (lastQueueEntry?.position ?? 0) + 1;

        // 5. Add to Queue
        // Position is ordered ascending in getLiveQueue.
        return await tx.queueEntry.create({
          data: {
            businessId: business.id,
            bookingId: booking.id,
            userId: user.id,
            status: "WAITING",
            position: nextPosition,
          },
          include: {
            booking: {
              include: {
                customer: true,
                service: true,
              },
            },
          },
        });
      });

      return res.status(201).json(result);
    } catch (err) {
      console.error("Error in addWalkins:", err.message);
      res.status(400).json({ error: err.message });
    }
  },
};
