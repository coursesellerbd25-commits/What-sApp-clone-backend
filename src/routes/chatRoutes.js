import express from "express";

import {
  createChat,
  getChats,
  getMessages
} from "../controllers/chatController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createChat);

router.get("/", getChats);

router.get("/:chatId/messages", getMessages);

export default router;