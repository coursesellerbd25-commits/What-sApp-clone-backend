import dotenv from "dotenv";
dotenv.config();

import http from "http";

import app from "./app.js";
import { Server } from "socket.io";

import { connectMongoDB } from "./config/mongo.js";
import { initializeSocket } from "./socket/socket.js";

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true
  }
});

initializeSocket(io);

const startServer = async () => {
  try {
    await connectMongoDB();

    httpServer.listen(PORT, () => {
      console.log(
        `Server running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

startServer();