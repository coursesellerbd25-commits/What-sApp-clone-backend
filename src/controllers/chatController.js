export const createChat = async (req, res) => {
  const client = await pool.connect();

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: "userId is required"
      });
    }

    if (userId === req.user.id) {
      return res.status(400).json({
        message: "You cannot chat with yourself"
      });
    }

    // Check that the other user exists
    const userResult = await client.query(
      `
      SELECT id, email
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    /*
      Find an existing 1-to-1 chat
      containing BOTH users.
    */
    const existingChat = await client.query(
      `
      SELECT cp1.chat_id
      FROM chat_participants cp1
      INNER JOIN chat_participants cp2
        ON cp1.chat_id = cp2.chat_id
      INNER JOIN chats c
        ON c.id = cp1.chat_id
      WHERE cp1.user_id = $1
        AND cp2.user_id = $2
      GROUP BY cp1.chat_id
      HAVING COUNT(DISTINCT cp1.user_id) = 1
         AND COUNT(DISTINCT cp2.user_id) = 1
      LIMIT 1
      `,
      [req.user.id, userId]
    );

    if (existingChat.rows.length > 0) {
      return res.json({
        chat: {
          id: existingChat.rows[0].chat_id
        },
        existing: true
      });
    }

    // Create a new chat
    await client.query("BEGIN");

    const chatId = uuidv4();

    await client.query(
      `
      INSERT INTO chats (id)
      VALUES ($1)
      `,
      [chatId]
    );

    await client.query(
      `
      INSERT INTO chat_participants
      (id, chat_id, user_id)
      VALUES ($1, $2, $3)
      `,
      [uuidv4(), chatId, req.user.id]
    );

    await client.query(
      `
      INSERT INTO chat_participants
      (id, chat_id, user_id)
      VALUES ($1, $2, $3)
      `,
      [uuidv4(), chatId, userId]
    );

    await client.query("COMMIT");

    res.status(201).json({
      chat: {
        id: chatId
      },
      existing: false
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create chat error:", error);

    res.status(500).json({
      message: "Could not create chat"
    });
  } finally {
    client.release();
  }
};

import { useEffect, useState } from "react";

import api from "../services/api";
import socket from "../services/socket";

export default function ChatWindow({
  chatId,
  currentUser
}) {
  const [messages, setMessages] = useState([]);

  const [text, setText] = useState("");

  const [loading, setLoading] = useState(true);

  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!chatId) return;

    let mounted = true;

    const loadMessages = async () => {
      try {
        setLoading(true);

        const response = await api.get(
          `/api/chats/${chatId}/messages`
        );

        if (mounted) {
          setMessages(response.data.messages);
        }
      } catch (error) {
        console.error(
          "Could not load messages:",
          error
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadMessages();

    return () => {
      mounted = false;
    };
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;

    // Connect socket
    if (!socket.connected) {
      socket.connect();
    }

    // Join this chat room
    socket.emit("join_chat", chatId);

    const handleNewMessage = (message) => {
      console.log(
        "New message received:",
        message
      );

      /*
        Prevent duplicate messages.
      */
      setMessages((previousMessages) => {
        const alreadyExists =
          previousMessages.some(
            (existingMessage) =>
              existingMessage.id === message.id
          );

        if (alreadyExists) {
          return previousMessages;
        }

        return [
          ...previousMessages,
          message
        ];
      });

      setSending(false);
    };

    socket.on(
      "new_message",
      handleNewMessage
    );

    const handleSocketError = (message) => {
      console.error(
        "Socket error:",
        message
      );

      setSending(false);
    };

    socket.on(
      "error_message",
      handleSocketError
    );

    return () => {
      socket.off(
        "new_message",
        handleNewMessage
      );

      socket.off(
        "error_message",
        handleSocketError
      );
    };
  }, [chatId]);

  const sendMessage = (e) => {
    e.preventDefault();

    const cleanText = text.trim();

    if (!cleanText) {
      return;
    }

    if (!socket.connected) {
      console.error(
        "Socket is not connected"
      );

      return;
    }

    setSending(true);

    socket.emit("send_message", {
      chatId,
      text: cleanText
    });

    setText("");
  };

  return (
    <div className="chat-window">

      {/* Header */}
      <div className="chat-header">
        <h2>Chat</h2>
      </div>

      {/* Messages */}
      <div className="messages">

        {loading ? (
          <p>Loading messages...</p>
        ) : messages.length === 0 ? (
          <p>No messages yet.</p>
        ) : (
          messages.map((message) => {
            const isMine =
              message.sender_id ===
              currentUser.id;

            return (
              <div
                key={message.id}
                className={
                  isMine
                    ? "message mine"
                    : "message"
                }
              >
                <div className="message-text">
                  {message.text_content}
                </div>

                <div className="message-time">
                  {new Date(
                    message.created_at
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </div>
              </div>
            );
          })
        )}

      </div>

      {/* Message Input */}
      <form
        onSubmit={sendMessage}
        className="message-form"
      >
        <input
          type="text"
          value={text}
          onChange={(e) =>
            setText(e.target.value)
          }
          placeholder="Type a message..."
          disabled={sending}
        />

        <button
          type="submit"
          disabled={
            sending || !text.trim()
          }
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>

    </div>
  );
}