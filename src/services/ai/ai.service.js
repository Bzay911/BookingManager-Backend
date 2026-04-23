import { bookingSystemPrompt } from "./prompt/systemPrompt.js";
import { toolsDispatcher } from "./dispatcher/toolsDispatcher.js";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export async function generateReply({ history, business, incomingMessage, customer}) {

  const systemPrompt = bookingSystemPrompt(business, customer);

  // Strip the current message from history to avoid duplication
  // (the controller already saved it, so history may include it)
 const priorHistory = history
    .filter((msg) => msg.content !== incomingMessage)
    .map((msg) => ({ role: msg.role, content: msg.content }));

  // its like double checking and adding the recent message to the context and in the format the ai expects  
  const messages = [
    ...priorHistory,
    { role: "user", content: incomingMessage }
  ];
  
  const tools = toolsDispatcher({ customer, business });

  const {text, toolCalls} = await generateText({
    model:  google("gemini-3.1-flash-lite-preview"),
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 2,
  });

if (toolCalls && toolCalls.length > 0) {
  const call = toolCalls[0];
  console.log('Call:', call);
  console.log("LLM wants to call tool:", call.toolName, "with args:", call.input);
  if (!call.input?.serviceId || !call.input?.scheduledAt) { //test this later
    console.warn("LLM called tool with incomplete args:", call.input);
    return { 
      type: "TEXT", 
      content: text
    };
  }

  return {
    type: "TOOL_CALL",
    tool: call.toolName,
    args: call.input, 
  };
}

  return {
    type: "TEXT",
    content: text,
  };
}
