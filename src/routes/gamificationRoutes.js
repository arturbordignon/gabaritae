const express = require("express");
const { getUserLevelAndPoints, updatePoints } = require("../controllers/gamificationController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", authMiddleware, getUserLevelAndPoints);
router.post("/update", authMiddleware, updatePoints);

module.exports = router;
