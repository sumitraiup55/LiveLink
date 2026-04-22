import express from "express";
import { createServer } from "node:http";

import mongoose from "mongoose";
import { connectToSocket } from "./controllers/socketManager.js";

import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import dotenv from "dotenv";
import userRoutes from "./routes/users.routes.js";
import aiRoutes from "./routes/ai.routes.js";

dotenv.config();

const app = express();
const server = createServer(app);
const io = connectToSocket(server);


app.set("port", (process.env.PORT || 8000))
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
    credentials: true
}));
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/ai", aiRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));

const start = async () => {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error("Missing MONGO_URI in environment.");
    }

    const connectionDb = await mongoose.connect(mongoUri);
    console.log(`MONGO Connected DB Host: ${connectionDb.connection.host}`)
    server.listen(app.get("port"), () => {
        console.log("LISTENIN ON PORT 8000")
    });



}



start();