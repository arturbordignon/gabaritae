const express = require("express");
const { getHomeDetails } = require("../controllers/homeController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", authMiddleware, getHomeDetails);

module.exports = router;
