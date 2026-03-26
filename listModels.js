import dotenv from "dotenv";
dotenv.config();

async function listMyModels() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log("No GEMINI_API_KEY in .env");
      return;
    }
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    if (data.models) {
        console.log("Available Models:");
        data.models.forEach(m => console.log(m.name, "-", m.description));
    } else {
        console.error("Failed to list models:", data);
    }
  } catch(e) {
    console.error("Error:", e);
  }
}

listMyModels();
