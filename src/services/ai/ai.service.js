import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import createBookingToolGemini from "./tools/createBookingToolGemini.js";
import Groq from "groq-sdk";
import createBookingToolGroq from "./tools/createBookingToolGroq.js";
import { bookingSystemPrompt } from "./prompt/systemPrompt.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Converts DB conversation rows into the format each AI provider expects
function formatHistoryForGemini(history) {
  // Drop leading assistant messages so history always starts with user
  const firstUserIndex = history.findIndex((msg) => msg.role === "user");
  const trimmed = firstUserIndex > 0 ? history.slice(firstUserIndex) : history;

  return trimmed.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
}

function formatHistoryForGroq(history) {
  return history.map((msg) => ({
    role: msg.role, // groq uses "user" / "assistant" directly
    content: msg.content,
  }));
}

async function callGemini({ systemPrompt, history, incomingMessage }) {
  const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
    systemInstruction: systemPrompt,
    // Give Gemini the tool so it knows it exists
    tools: { functionDeclarations: [createBookingToolGemini] },
  });

  const chat = model.startChat({
    history: formatHistoryForGemini(history),
  });

  const result = await chat.sendMessage(incomingMessage);

  // Did Gemini decide to call our booking function?
  const functionCalls = result.response.functionCalls();
  if (functionCalls && functionCalls.length > 0) {
    const call = functionCalls[0];
    console.log("Gemini wants to make a booking!", call.args);
    return {
      type: "TOOL_CALL",
      tool: call.name, // Will be "create_booking"
      args: call.args, // Will be { serviceId: 2, scheduledAt: '...' }
    };
  }

  // Otherwise, return regular conversational text
  return {
    type: "TEXT",
    content: result.response.text(),
  };
}

// Groq (fallback)
async function callGroq({ systemPrompt, history, incomingMessage }) {
  const messages = [
    { role: "system", content: systemPrompt },
    ...formatHistoryForGroq(history),
    { role: "user", content: incomingMessage },
  ];

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages,
    max_tokens: 300,
    // Give Groq the tool array
    tools: createBookingToolGroq,
  });

  const responseMessage = completion.choices[0].message;

  // Did Groq decide to call our booking function?
  if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
    const toolCall = responseMessage.tool_calls[0];
    console.log("Groq wants to make a booking!", toolCall.function.arguments);
    return {
      type: "TOOL_CALL",
      tool: toolCall.function.name, // Will be "create_booking"
      args: JSON.parse(toolCall.function.arguments), // Groq returns arguments as a string, so we parse it
    };
  }

  // Otherwise, return regular conversational text
  return {
    type: "TEXT",
    content: responseMessage.content,
  };
}

export async function generateReply({
  history,
  business,
  incomingMessage,
  customer,
}) {
  const systemPrompt = bookingSystemPrompt(business, customer);

  // Strip the current message from history to avoid duplication
  // (the controller already saved it, so history may include it)
  const priorHistory = history.filter((msg) => msg.content !== incomingMessage);

  try {
    console.log("Calling Gemini...");
    const reply = await callGemini({
      systemPrompt,
      history: priorHistory,
      incomingMessage,
    });
    console.log("Gemini replied", reply);
    return reply;
  } catch (geminiError) {
    console.warn("Gemini failed, falling back to Groq:", geminiError.message);

    try {
      const reply = await callGroq({
        systemPrompt,
        history: priorHistory,
        incomingMessage,
      });
      console.log("Groq replied (fallback)");
      return reply;
    } catch (groqError) {
      console.error("Both AI providers failed:", groqError.message);
      return "Sorry, we're experiencing technical difficulties. Please call us directly and we'll be happy to help!";
    }
  }
}
