import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import createBookingToolGemini from "./createBookingToolGemini.js";
import Groq from "groq-sdk";
import createBookingToolGroq from "./createBookingToolGroq.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function buildSystemPrompt(business, customer) {
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const customerContext = customer?.displayName
    ? `You are talking to ${customer.displayName}, a returning customer.`
    : `This is a new customer. Greet them warmly, thank them for reaching out to ${business?.businessName}, and 
      politely ask for their full name before anything else. Keep it to one short friendly message.`;

  return `You are a helpful booking assistant for ${business?.businessName ?? "a local business"}.
Your job is to help customers with bookings, answer questions about services, and provide information.
Today is ${currentDate}.
 
Customer: ${customerContext}

Business details:
- Name: ${business?.businessName ?? "N/A"}
- Phone: ${business?.businessPhoneNumber ?? "N/A"}
- Address: ${business?.businessAddress ?? "N/A"}
- Email: ${business?.businessEmail ?? "N/A"}
- Hours: ${business?.openingTime ?? "N/A"} - ${business?.closingTime ?? "N/A"}
- Description: ${business?.description ?? "N/A"}
- Services: ${business?.services?.map((s) => `${s.service} (id:${s.id}, $${s.price}, ${s.durationMinutes}mins)`).join(", ") ?? "N/A"}

Booking instructions:
- When the customer wants to book, collect: service choice and preferred date + time.
- Always confirm all details with the customer before finalising.
- IMPORTANT: Once the customer explicitly confirms, YOU MUST USE the 'create_booking' function/tool to finalize it.
- Never use the function unless the customer has explicitly confirmed the service and time.
 
Guidelines:
- Be friendly, concise, and professional
- Keep replies short — this is WhatsApp, not email
- If you cannot help, politely ask them to call the business directly
- Never make up information that isn't in the business details above`;
}

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
    model: "gemini-2.5-flash",
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
  const systemPrompt = buildSystemPrompt(business, customer);

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
