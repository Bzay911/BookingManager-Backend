import prisma from "../lib/prisma.js";

async function updateCustomerName(customer, history, incomingMessage, phoneNumber) {
  if (customer.displayName) return customer;
 
  const lastAssistantMsg = history
    .filter((msg) => msg.role === "assistant")
    .at(-1);
 
  if (lastAssistantMsg?.content.toLowerCase().includes("name")) {
    customer = await prisma.user.update({
      where: { phoneNumber },
      data: { displayName: incomingMessage },
    });
  }
 
  return customer;
};

export default updateCustomerName;