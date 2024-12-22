const express = require("express");
const { saveExamHistory, getUserHistory } = require("../controllers/historyController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/save", authMiddleware, saveExamHistory);
router.get("/user", authMiddleware, getUserHistory);

module.exports = router;
