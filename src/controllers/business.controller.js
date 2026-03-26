import prisma from "../lib/prisma.js";
import twilio from "twilio";
import FormatPhoneNumber from "../utils/PhoneNumberFormatter.js";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

export const businessController = {
  async sendOtp(req, res) {
    let { businessPhoneNumber } = req.body;
    console.log("Received OTP request for phone number:", businessPhoneNumber);

    if (!businessPhoneNumber) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    businessPhoneNumber = FormatPhoneNumber(businessPhoneNumber);

    console.log(
      "Transformed phone number to E.164 format:",
      businessPhoneNumber,
    );

    try {
      const verification = await client.verify.v2
        .services(VERIFY_SERVICE_SID)
        .verifications.create({ to: businessPhoneNumber, channel: "sms" });
      console.log(
        `OTP sent to ${businessPhoneNumber} — status: ${verification.status}`,
      );
      return res
        .status(200)
        .json({ success: true, message: "OTP sent successfully" });
    } catch (error) {
      console.error("Error sending OTP:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to send OTP" });
    }
  },

  async verifyOtp(req, res) {
    let { businessPhoneNumber, code } = req.body;

    if (!businessPhoneNumber || !code) {
      return res
        .status(400)
        .json({ error: "Phone number and code are required" });
    }

    businessPhoneNumber = FormatPhoneNumber(businessPhoneNumber);

    try {
      const verificationCheck = await client.verify.v2
        .services(VERIFY_SERVICE_SID)
        .verificationChecks.create({ to: businessPhoneNumber, code });

      console.log(
        `OTP check for ${businessPhoneNumber} — status: ${verificationCheck.status}`,
      );

      if (verificationCheck.status === "approved") {
        console.log(`OTP verified successfully for ${businessPhoneNumber}`);
        return res
          .status(200)
          .json({ success: true, message: "OTP verified successfully" });
      } else {
        return res.status(400).json({ success: false, error: "Invalid OTP" });
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
         if (err.status === 404) {
      return res.status(400).json({ 
        success: false, 
        verified: false,
        error: 'Code expired. Please request a new one.' 
      });
    }

    if (err.code === 60202) {
      return res.status(400).json({ 
        success: false,
        verified: false,
        error: 'Too many attempts. Please request a new code.' 
      });
    }
      return res
        .status(500)
        .json({ success: false, error: "Failed to verify OTP" });
    }
  },

  async setupBusiness(req, res) {
    try {
      const {
        businessName,
        description,
        businessAddress,
        businessPhoneNumber,
        businessEmail,
        openingTime,
        closingTime,
        cancellationFee,
        services, 
      } = req.body;

      console.log("Received business setup request with data:", req.body);
      const userId = req.user.id;

      if (
        !businessName ||
        !businessAddress ||
        !businessPhoneNumber ||
        !businessEmail ||
        !openingTime ||
        !closingTime
      ) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check user isn't already a business owner
      const existing = await prisma.business.findUnique({
        where: { ownerId: userId },
      });

      if (existing) {
        return res.status(400).json({ error: "Business already set up" });
      }

      // Create business + services in one transaction
      const business = await prisma.$transaction(async (tx) => {
        // Create the business
        const newBusiness = await tx.business.create({
          data: {
            businessName,
            description,
            businessAddress,
            businessPhoneNumber,
            businessEmail,
            openingTime,
            closingTime,
            cancellationFeePercent: cancellationFee ?? 0,
            ownerId: userId,
          },
        });

        // Create services if provided
        if (services && services.length > 0) {
          await tx.service.createMany({
            data: services.map((s) => ({
              service: s.name,
              price: parseFloat(s.price),
              durationMinutes: parseInt(s.duration, 10),
              businessId: newBusiness.id,
            })),
          });
        }

        return newBusiness;
      });

      // Step 4 — Mark user as onboarded
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          isOnboarded: true,
          onboardedAt: new Date(),
        },
      });

      return res.status(201).json({
        message: "Business setup complete",
        business,
        user: {
          id: updatedUser.id,
          displayName: updatedUser.displayName,
          email: updatedUser.email,
          profileImage: updatedUser.profileImage,
          role: updatedUser.role,
          isOnboarded: updatedUser.isOnboarded,
        },
      });
    } catch (error) {
      console.error("Setup business error:", error);
      return res.status(500).json({ error: "Failed to setup business" });
    }
  },

async getBusinessByOwner(req, res) {
  const userId = req.user.id;
  try {
    // Change findUnique to findMany to get an ARRAY
    const businesses = await prisma.business.findMany({
      where: { ownerId: userId },
      include: { services: true }
    });

    // findMany returns an empty array [] if nothing is found, 
    // so we check length instead of !businesses
    if (businesses.length === 0) {
      return res.status(404).json({ error: "No businesses found for this owner" });
    }

    return res.json(businesses); // This now sends [...]
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch business" });
  }
},

  async getAllBusinesses(req, res){
    try{
      console.log("Received request to fetch all businesses with services");
        const businesses = await prisma.business.findMany({
            include: { services: true }
        });
        console.log("Fetched all businesses with services:", businesses);
        res.status(200).json(businesses);
    }catch(error){
      console.error("Error fetching all businesses with services:", error);
        res.status(500).json({ error: error.message });
    };
  },

  async fetchBusinessById(req,res){
    try{
      const { id } = req.params;
      console.log(`Received request to fetch business with ID: ${id}`);
      const business = await prisma.business.findUnique({
        where: { id: parseInt(id) },
        include: { services: true }
      });
      if (!business) {
        console.log(`Business with ID ${id} not found`);
        return res.status(404).json({ error: "Business not found" });
      }
      console.log(`Fetched business with ID ${id}:`, business);
      res.status(200).json(business);
    }catch(error){
      console.error(`Error fetching business with ID ${req.params.id}:`, error);
      res.status(500).json({ error: error.message });
    }
  }
};
