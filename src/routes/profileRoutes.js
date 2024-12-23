const express = require("express");
const { getProfile, updateProfile, changePassword } = require("../controllers/profileController");
const authMiddleware = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.get("/me", authMiddleware, getProfile);
router.put("/update", authMiddleware, upload.single("profilePicture"), updateProfile);
router.post("/change-password", authMiddleware, changePassword);

module.exports = router;
