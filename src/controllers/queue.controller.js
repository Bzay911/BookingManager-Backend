import prisma from "../lib/prisma.js";

export const queueController = {
  async getLiveQueue(req, res) {
    try {
      const userId = req.user.id;
      const business = await prisma.business.findFirst({
        where: { ownerId: userId }
      });

      if (!business) {
        return res.status(404).json({ error: "Business not found for this user" });
      }

      // today's date range
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const liveQueue = await prisma.queueEntry.findMany({
        where: {
          businessId: business.id,
          status: { not: "DONE" },        // exclude finished entries
          booking: {
            scheduledAt: {
              gte: todayStart,            // from midnight
              lte: todayEnd               // to end of day
            }
          }
        },
        include: {
          booking: {
            include: {
              customer: {
                select: {
                  displayName: true,
                  phoneNumber: true
                }
              },
              service: {
                select: {
                  service: true,
                  durationMinutes: true,
                  price: true
                }
              }
            }
          }
        },
        orderBy: { position: "asc" }      // position 1 at the top
      });

      console.log('live queue:',liveQueue);
      return res.json(liveQueue);

    } catch (err) {
      console.error("Error fetching live queue", err);
      res.status(500).json({ error: "Failed to fetch live queue" });
    }
  }
};