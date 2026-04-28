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
  const bookingAgent = new ToolLoopAgent({
    model: google("gemini-3-flash-preview"),
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
