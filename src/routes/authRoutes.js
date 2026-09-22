import express from "express";

import {
  signup,
  login,
  logout,
  getMe,
  getUsers
} from "../controllers/authController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/signup", signup);

router.post("/login", login);

router.post("/logout", logout);

router.get("/me", protect, getMe);

router.get("/users", protect, getUsers);

export default router;