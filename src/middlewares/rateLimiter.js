import { connection } from "../lib/queue.js";
import twilio from "twilio";

const BUCKET_LIMIT = 5;
const REFILL_RATE = 0.5;
const DAILY_LIMIT = 50;

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

async function tokenBucketCheck(phoneNumber) {
  const key = `rate_limit_bucket:${phoneNumber}`;
  const now = Date.now();

  // read current bucket state from Redis
  const bucket = await connection.hgetall(key);
  console.log(`[RateLimiter] Bucket state for ${phoneNumber}:`, bucket);

  let tokens = bucket.tokens ? parseFloat(bucket.tokens) : BUCKET_LIMIT;
  let lastRefill = bucket.lastRefill ? parseInt(bucket.lastRefill) : now;

  // calculate how many tokens have refilled since last message
  const secondsPassed = (now - lastRefill) / 1000;
  const tokensRefilled = secondsPassed * REFILL_RATE;
  tokens = Math.min(BUCKET_LIMIT, tokens + tokensRefilled);

  console.log(
    `[RateLimiter] ${phoneNumber} - seconds passed: ${secondsPassed.toFixed(2)}s, tokens after refill: ${tokens.toFixed(2)}`,
  );

  if (tokens < 1) {
    console.warn(
      `[RateLimiter] BURST BLOCKED - ${phoneNumber} has ${tokens.toFixed(2)} tokens`);
    return false;
  }

  // consume one token
  tokens -= 1;
  console.log(
    `[RateLimiter] ${phoneNumber} - token consumed, remaining: ${tokens.toFixed(2)}`,
  );

  await connection.hset(key, {
    tokens: tokens.toString(),
    lastRefill: now.toString(),
  });
  await connection.expire(key, 3600);

  return true;
}

async function dailyLimitCheck(phoneNumber) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `daily_limit:${phoneNumber}:${today}`;

  const count = await connection.incr(key);
  console.log(
    `[RateLimiter] ${phoneNumber} - daily message count: ${count}/${DAILY_LIMIT}`,
  );

  if (count === 1) {
    await connection.expire(key, 86400);
    console.log(
      `[RateLimiter] ${phoneNumber} - new day, expiry set for daily key`,
    );
  }

  if (count > DAILY_LIMIT) {
    console.warn(
      `[RateLimiter] DAILY BLOCKED - ${phoneNumber} has sent ${count} messages today`,
    );
    return false;
  }

  return true;
}

export async function rateLimiter(req, res, next) {
  const customerPhone = req.body.From;
  const phone = customerPhone?.replace("whatsapp:", "");

  console.log(`[RateLimiter] Incoming message from ${phone}`);

  if (!phone) {
    console.error("[RateLimiter] No phone number found in request");
    return res.status(400).json({ error: "Invalid phone number" });
  }

  try {
    // Layer 1 — burst check
    const burstAllowed = await tokenBucketCheck(phone);
    if (!burstAllowed) {
      await twilioClient.messages.create({
        from: "whatsapp:+14155238886",
        to: `whatsapp:${phone}`, 
        body: "Please slow down! Send me a message in a few seconds.",
      });
      // return empty TwiML so Twilio doesn't retry the webhook
      return res
        .type("text/xml")
        .send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
    }

    // Layer 2 — daily check
    const dailyAllowed = await dailyLimitCheck(phone);
    if (!dailyAllowed) {
      await twilioClient.messages.create({
        from: "whatsapp:+14155238886",
        to: `whatsapp:${phone}`,
        body: "You've reached your daily message limit. Please try again tomorrow.",
      });
      return res
        .type("text/xml")
        .send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
    }

    console.log(
      `[RateLimiter] ${phone} passed all checks — proceeding to controller`,
    );
    next();
  } catch (err) {
    console.error("[RateLimiter] Redis error — failing open:", err.message);
    next(); 
  }
}
