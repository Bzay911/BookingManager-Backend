import prisma from "../src/lib/prisma.js";

async function findOrCreateCustomer(phoneNumber) {
  let customer = await prisma.user.findUnique({
    where: { phoneNumber },
  });

  if (!customer) {
    customer = await prisma.user.create({
      data: {
        phoneNumber,
        role: "CUSTOMER",
      },
    });
  }

  return customer;
};

export default findOrCreateCustomer;