const express = require("express");
const simuladoController = require("../controllers/simuladoController");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

// router.get("/topics", authMiddleware, listTopics);
// router.post("/simulado", authMiddleware, getSimulado);
// router.get("/history", authMiddleware, getUserSimuladoHistory);
// router.get("/check-vidas", authMiddleware, checkVidas);
// router.get("/status", authMiddleware, getSimuladoStatus);

router.post("/start", authMiddleware, simuladoController.startSimulado);
router.post("/answer", authMiddleware, simuladoController.submitAnswer);
router.get("/status", authMiddleware, simuladoController.getSimuladoStatus);
router.get("/:discipline/:simuladoNumber", authMiddleware, simuladoController.getSimuladoDetails);

module.exports = router;
