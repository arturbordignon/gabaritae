const express = require("express");
const { getProfile, updateProfile, changePassword } = require("../controllers/profileController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/me", authMiddleware, getProfile);
router.put("/update", authMiddleware, updateProfile);
router.post("/change-password", authMiddleware, changePassword);

module.exports = router;
