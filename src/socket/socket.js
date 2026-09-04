import jwt from "jsonwebtoken";
import cookie from "cookie";

import pool from "../config/db.js";
import Message from "../models/Message.js";
import { v4 as uuidv4 } from "uuid";

export const initializeSocket = (io) => {
  io.use((socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;

      if (!rawCookie) {
        return next(
          new Error("Authentication required")
        );
      }

      const cookies = cookie.parse(rawCookie);

      const token = cookies.token;

      if (!token) {
        return next(
          new Error("Authentication required")
        );
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      socket.user = {
        id: decoded.id,
        email: decoded.email
      };

      next();
    } catch (error) {
      next(new Error("Invalid authentication"));
    }
  });

  io.on("connection", (socket) => {
    console.log(
      `User connected: ${socket.user.id}`
    );

    socket.on("join_chat", async (chatId) => {
      try {
        const result = await pool.query(
          `
          SELECT id
          FROM chat_participants
          WHERE chat_id = $1
          AND user_id = $2
          `,
          [chatId, socket.user.id]
        );

        if (result.rows.length === 0) {
          return socket.emit(
            "error_message",
            "You are not a participant in this chat"
          );
        }

        socket.join(chatId);

        console.log(
          `User ${socket.user.id} joined ${chatId}`
        );
      } catch (error) {
        console.error(error);
      }
    });

    socket.on(
      "send_message",
      async ({ chatId, text }) => {
        try {
          if (!text || !text.trim()) {
            return;
          }

          const participant = await pool.query(
            `
            SELECT id
            FROM chat_participants
            WHERE chat_id = $1
            AND user_id = $2
            `,
            [chatId, socket.user.id]
          );

          if (participant.rows.length === 0) {
            return;
          }

          const messageId = uuidv4();

          const cleanText = text.trim();

          const pgMessage = await pool.query(
            `
            INSERT INTO messages
            (
              id,
              chat_id,
              sender_id,
              text_content
            )
            VALUES ($1, $2, $3, $4)
            RETURNING *
            `,
            [
              messageId,
              chatId,
              socket.user.id,
              cleanText
            ]
          );

          const message = pgMessage.rows[0];

          await Message.create({
            messageId,
            chatId,
            senderId: socket.user.id,
            textContent: cleanText
          });

          io.to(chatId).emit(
            "new_message",
            message
          );
        } catch (error) {
          console.error(
            "Send message error:",
            error
          );

          socket.emit(
            "error_message",
            "Could not send message"
          );
        }
      }
    );

    socket.on("disconnect", () => {
      console.log(
        `User disconnected: ${socket.user.id}`
      );
    });
  });
};