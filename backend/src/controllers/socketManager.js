import { Server } from "socket.io";
import { User } from "../models/user.model.js";

const MAX_ROOM_ID_LEN = 64;
const MAX_ROOM_SIZE = 16;
const MAX_MESSAGES_PER_ROOM = 200;

const roomConnections = new Map(); // roomId -> Set(socketId)
const roomMessages = new Map(); // roomId -> Array<{sender,data,socketIdSender}>
const socketToRoom = new Map(); // socketId -> roomId

function normalizeRoomId(raw) {
  const roomId = String(raw || "")
    .trim()
    .slice(0, MAX_ROOM_ID_LEN)
    .replace(/[^a-zA-Z0-9_-]/g, "");
  return roomId;
}

async function resolveSocketIdentity(socket) {
  const token =
    socket.handshake?.auth?.token ||
    socket.handshake?.headers?.authorization?.toString()?.replace(/^bearer\s+/i, "");

  if (token) {
    const user = await User.findOne({ token }).lean();
    if (user) return { kind: "user", name: user.name, username: user.username };
  }

  const guestName = String(socket.handshake?.auth?.guestName || "").trim().slice(0, 32);
  if (guestName) return { kind: "guest", name: guestName, username: guestName };

  return null;
}

export const connectToSocket = (server) => {
  const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*";

  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingInterval: 20000,
    pingTimeout: 20000,
  });

  io.use(async (socket, next) => {
    try {
      const identity = await resolveSocketIdentity(socket);
      if (!identity) {
        return next(new Error("unauthorized"));
      }
      socket.data.identity = identity;
      return next();
    } catch (e) {
      return next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join-call", (rawRoomId) => {
      const roomId = normalizeRoomId(rawRoomId);
      if (!roomId) {
        socket.emit("join-error", "Invalid meeting code");
        return;
      }

      const currentSet = roomConnections.get(roomId) || new Set();
      if (currentSet.size >= MAX_ROOM_SIZE) {
        socket.emit("join-error", "Room is full");
        return;
      }

      socket.join(roomId);
      socketToRoom.set(socket.id, roomId);
      currentSet.add(socket.id);
      roomConnections.set(roomId, currentSet);

      const clients = Array.from(currentSet);

      // Notify everyone (including self) about join + full client list
      io.to(roomId).emit("user-joined", socket.id, clients, socket.data.identity);

      // Replay recent messages to the newly joined socket
      const history = roomMessages.get(roomId) || [];
      for (const m of history) {
        io.to(socket.id).emit("chat-message", m.data, m.sender, m.socketIdSender);
      }
    });

    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    socket.on("chat-message", (data, sender) => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;

      const safeData = String(data || "").slice(0, 2000);
      const safeSender =
        (socket.data.identity?.kind === "user" ? socket.data.identity.username : socket.data.identity?.name) ||
        String(sender || "").slice(0, 32);

      const list = roomMessages.get(roomId) || [];
      list.push({ sender: safeSender, data: safeData, socketIdSender: socket.id });
      if (list.length > MAX_MESSAGES_PER_ROOM) list.shift();
      roomMessages.set(roomId, list);

      io.to(roomId).emit("chat-message", safeData, safeSender, socket.id);
    });

    socket.on("disconnect", () => {
      const roomId = socketToRoom.get(socket.id);
      socketToRoom.delete(socket.id);
      if (!roomId) return;

      const set = roomConnections.get(roomId);
      if (set) {
        set.delete(socket.id);
        io.to(roomId).emit("user-left", socket.id);
        if (set.size === 0) {
          roomConnections.delete(roomId);
          roomMessages.delete(roomId);
        } else {
          roomConnections.set(roomId, set);
        }
      }
    });
  });

  return io;
};

