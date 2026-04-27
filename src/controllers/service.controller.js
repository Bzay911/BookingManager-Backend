import prisma from "../lib/prisma.js";

export const serviceController = {
  async getServices(req, res) {
    try {
      const { businessId } = req.params;
      const services = await prisma.service.findMany({
        where: { businessId: parseInt(businessId) },
        include: { business: true },
      });
      console.log(
        "Fetched services for businessId:",
        businessId,
        "Services:",
        services,
      );
      res.status(200).json(services);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async addService(req, res) {
    try {
      console.log("Received request to add service with body:", req.body);
      const userId = req.user.id;
      console.log(`Fetching business for user ID ${userId}`);
      const business = await prisma.business.findUnique({
        where: { ownerId: userId },
      });
      if (!business) {
        console.log(`Business not found for user ID ${userId}`);
        return res.status(404).json({ error: "Business not found" });
      }
      const { serviceName, servicePrice, serviceDuration } = req.body;

      const newService = await prisma.service.create({
        data: {
          service: serviceName,
          price: parseFloat(servicePrice),
          durationMinutes: parseInt(serviceDuration, 10),
          businessId: business.id,
        },
      });
      res.status(201).json(newService);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};
