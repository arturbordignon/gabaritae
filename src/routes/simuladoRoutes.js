const express = require("express");
const {
  getSimulado,
  getUserSimuladoHistory,
  listTopics,
  checkVidas,
  getSimuladoStatus,
} = require("../controllers/simuladoController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/topics", listTopics);
router.post("/simulado", authMiddleware, getSimulado);
router.get("/history", authMiddleware, getUserSimuladoHistory);
router.get("/check-vidas", authMiddleware, checkVidas);
router.get("/status", authMiddleware, getSimuladoStatus);

module.exports = router;
