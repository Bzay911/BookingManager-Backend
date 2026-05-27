import { bookingSystemPrompt } from "./prompt/systemPrompt.js";
import { createBookingTool } from "./tools/createBookingTool.js";
import { generateTimeslotsTool } from "./tools/generateSlotsTool.js";
import { checkBookingStatusTool } from "./tools/checkBookingStatus.js";
import { ToolLoopAgent } from "ai";
// import { google } from "@ai-sdk/google";
import { openai } from '@ai-sdk/openai';

export async function generateReply({
  history,
  business,
  incomingMessage,
  customer,
}) {
  // console.log("Generating AI reply with history:", history, "business:", business, "customer:", customer);
  const bookingAgent = new ToolLoopAgent({
    // model: google("gemini-2.5-flash-lite"),
    model: openai("gpt-5.4-nano"),
    instructions: bookingSystemPrompt(business, customer),
    tools: {
      create_booking: createBookingTool(business, customer),
      generate_time_slots: generateTimeslotsTool(business),
      check_booking_status: checkBookingStatusTool(business, customer),
    }
  });

  const messages = history.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
  const result = await bookingAgent.generate({ messages });

  return {
    type: "TEXT",
    content: result.text,
    steps: result.steps,
  };
}
