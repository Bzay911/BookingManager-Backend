import prisma from "../src/lib/prisma.js";

async function fetchAIContext(phoneNumber, businessId) {
  const [history, business] = await Promise.all([
    prisma.conversation.findMany({
      where: { customerPhone: phoneNumber, businessId },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
    businessId
      ? prisma.business.findUnique({
          where: { id: businessId },
          include: { services: true },
        })
      : null,
  ]);
 
  return { history, business };
};

export default fetchAIContext;