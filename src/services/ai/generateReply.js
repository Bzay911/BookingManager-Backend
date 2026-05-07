import { bookingSystemPrompt } from "./prompt/systemPrompt.js";
import { createBookingTool } from "./tools/createBookingTool.js";
import { generateTimeslotsTool } from "./tools/generateSlotsTool.js";
import { ToolLoopAgent } from "ai";
import { google } from "@ai-sdk/google";

export async function generateReply({
  history,
  business,
  incomingMessage,
  customer,
}) {
  // console.log("Generating AI reply with history:", history, "business:", business, "customer:", customer);
  const bookingAgent = new ToolLoopAgent({
    model: google("gemini-2.5-flash-lite"),
    instructions: bookingSystemPrompt(business, customer),
    tools: {
      create_booking: createBookingTool(business, customer),
      generate_time_slots: generateTimeslotsTool(business),
    }
  });

  const messages = history.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
  const { text } = await bookingAgent.generate({ messages });

  return {
    type: "TEXT",
    content: text,
  };
}
