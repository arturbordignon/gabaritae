const express = require("express");
const {
  saveExamHistory,
  getUserHistory,
  getUserSimuladoHistory,
} = require("../controllers/historyController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/save", authMiddleware, saveExamHistory);

router.get("/user", authMiddleware, getUserHistory);

router.get("/detailed", authMiddleware, getUserSimuladoHistory);

module.exports = router;
