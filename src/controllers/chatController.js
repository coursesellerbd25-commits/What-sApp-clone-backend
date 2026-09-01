import pool from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

export const createChat = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: "userId is required"
      });
    }

    const chatId = uuidv4();

    await pool.query("BEGIN");

    await pool.query(
      `
      INSERT INTO chats (id)
      VALUES ($1)
      `,
      [chatId]
    );

    await pool.query(
      `
      INSERT INTO chat_participants
      (id, chat_id, user_id)
      VALUES ($1, $2, $3)
      `,
      [uuidv4(), chatId, req.user.id]
    );

    await pool.query(
      `
      INSERT INTO chat_participants
      (id, chat_id, user_id)
      VALUES ($1, $2, $3)
      `,
      [uuidv4(), chatId, userId]
    );

    await pool.query("COMMIT");

    res.status(201).json({
      chat: {
        id: chatId
      }
    });
  } catch (error) {
    await pool.query("ROLLBACK");

    console.error(error);

    res.status(500).json({
      message: "Could not create chat"
    });
  }
};

export const getChats = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        c.id,
        c.created_at
      FROM chats c
      INNER JOIN chat_participants cp
        ON cp.chat_id = c.id
      WHERE cp.user_id = $1
      ORDER BY c.created_at DESC
      `,
      [req.user.id]
    );

    res.json({
      chats: result.rows
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not load chats"
    });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;

    const participant = await pool.query(
      `
      SELECT id
      FROM chat_participants
      WHERE chat_id = $1
      AND user_id = $2
      `,
      [chatId, req.user.id]
    );

    if (participant.rows.length === 0) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        chat_id,
        sender_id,
        text_content,
        created_at
      FROM messages
      WHERE chat_id = $1
      ORDER BY created_at ASC
      `,
      [chatId]
    );

    res.json({
      messages: result.rows
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not load messages"
    });
  }
};