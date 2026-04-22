import httpStatus from "http-status";
import { GoogleGenAI } from "@google/genai";
import { User } from "../models/user.model.js";

// ✅ Keep constants OUTSIDE
const DEFAULT_MODEL = "gemini-3-flash-preview";

function getTokenFromReq(req) {
  const header = req.headers.authorization || "";

  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }

  return req.query.token || req.body?.token;
}

// ✅ ONLY ONE export
export const chatWithAi = async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(httpStatus.SERVICE_UNAVAILABLE).json({
      message: "Missing GEMINI_API_KEY in environment.",
    });
  }

  // ✅ Initialize AI INSIDE function
  const ai = new GoogleGenAI({
    apiKey: apiKey,
  });

  const token = getTokenFromReq(req);

  if (!token) {
    return res.status(httpStatus.UNAUTHORIZED).json({
      message: "Missing token.",
    });
  }

  const { message, history } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(httpStatus.BAD_REQUEST).json({
      message: "Missing message.",
    });
  }

  try {
    const user = await User.findOne({ token });

    if (!user) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        message: "Invalid token.",
      });
    }

    // ✅ Build conversation safely
    let conversation = "";

    if (Array.isArray(history)) {
      const safeHistory = history
        .slice(-10)
        .filter(
          (h) =>
            h &&
            (h.role === "user" || h.role === "model") &&
            typeof h.text === "string"
        );

      conversation = safeHistory
        .map((h) => `${h.role === "user" ? "User" : "AI"}: ${h.text}`)
        .join("\n");
    }

    const prompt = `
You are LiveLink's private assistant for ${user.name} (@${user.username}).
Keep replies short, clear, and helpful.

${conversation}

User: ${message}
`;

    // ✅ Call Gemini API
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      contents: prompt,
    });

    const reply = response?.text || "No response from AI";

    return res.status(httpStatus.OK).json({ reply });

  } catch (e) {
    console.error("AI ERROR:", e);

    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: `AI error: ${e?.message || e}`,
    });
  }
};