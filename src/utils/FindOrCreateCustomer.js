import prisma from "../lib/prisma.js";

async function findOrCreateCustomer(phoneNumber) {
  let customer = await prisma.user.findUnique({
    where: { phoneNumber },
  });

  console.log("Customer lookup for phone number:", phoneNumber, "Result:", customer);
  
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