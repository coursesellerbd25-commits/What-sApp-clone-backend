import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
      unique: true
    },

    chatId: {
      type: String,
      required: true,
      index: true
    },

    senderId: {
      type: String,
      required: true
    },

    textContent: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;