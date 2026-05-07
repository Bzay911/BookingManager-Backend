import prisma from "../lib/prisma.js";

export default async function findOrCreateConversation(customerPhone, businessId) {
    const exisiting = await prisma.conversation.findFirst({
        where: {
            customerPhone,
            businessId,
            status: "ACTIVE"
        },
        orderBy: {
            createdAt: "desc"
        },
        include: {
            messages: {
                orderBy: {
                    createdAt: "asc"
                }
            }
        }
    });

    
    if (exisiting) {
        console.log("Existing conversation found:", exisiting);
        return exisiting;
    }

    console.log("No existing conversation found. Creating new conversation for phone:", customerPhone, "and businessId:", businessId);

    return prisma.conversation.create({
        data: {
            customerPhone,
            businessId,
        },
        include: { messages: true },
    });
}