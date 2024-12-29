const express = require("express");
const simuladoController = require("../controllers/simuladoController");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.post("/start", authMiddleware, simuladoController.startSimulado);
router.post("/answer", authMiddleware, simuladoController.submitAnswer);
router.get("/status", authMiddleware, simuladoController.getSimuladoStatus);
router.get("/:discipline/:simuladoNumber", authMiddleware, simuladoController.getSimuladoDetails);

module.exports = router;
