import { bookingSystemPrompt } from "./prompt/systemPrompt.js";
import { toolsDispatcher } from "./tools/toolsDispatcher.js";
import { ToolLoopAgent } from "ai";
import { google } from "@ai-sdk/google";
import { type } from "node:os";

export async function generateReply({
  history,
  business,
  incomingMessage,
  customer,
}) {
  const bookingAgent = new ToolLoopAgent({
    model: google("gemini-3-flash-preview"),
    instructions: bookingSystemPrompt(business, customer),
    tools: toolsDispatcher({ customer, business }),
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
