import httpStatus from "http-status";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { User } from "../models/user.model.js";

const DEFAULT_MODEL = "gemini-1.5-flash";

function getTokenFromReq(req) {
  const header = req.headers.authorization || "";
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return req.query.token || req.body?.token;
}

export const chatWithAi = async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res
      .status(httpStatus.SERVICE_UNAVAILABLE)
      .json({ message: "Missing GEMINI_API_KEY in environment." });
  }

  const token = getTokenFromReq(req);
  if (!token) {
    return res.status(httpStatus.UNAUTHORIZED).json({ message: "Missing token." });
  }

  const { message, history } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(httpStatus.BAD_REQUEST).json({ message: "Missing message." });
  }

  try {
    const user = await User.findOne({ token });
    if (!user) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid token." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || DEFAULT_MODEL });

    const safeHistory = Array.isArray(history)
      ? history
          .slice(-12)
          .filter(
            (h) =>
              h &&
              (h.role === "user" || h.role === "model") &&
              typeof h.text === "string" &&
              h.text.length > 0
          )
          .map((h) => ({ role: h.role, parts: [{ text: h.text }] }))
      : [];

    const chat = model.startChat({
      history: safeHistory,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 500,
      },
    });

    const prompt = `You are LiveLink's private assistant for ${user.name} (@${user.username}). Keep replies concise and helpful.\n\nUser: ${message}`;
    const result = await chat.sendMessage(prompt);
    const text = result.response.text();

    return res.status(httpStatus.OK).json({ reply: text });
  } catch (e) {
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: `AI error: ${e?.message || e}` });
  }
};

