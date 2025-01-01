const express = require("express");
const simuladoController = require("../controllers/simuladoController");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/provas", authMiddleware, simuladoController.getExams);
router.post("/start", authMiddleware, simuladoController.startSimulado);
router.post("/answer", authMiddleware, simuladoController.submitAnswer);
router.get("/status", authMiddleware, simuladoController.getSimuladoStatus);
router.get("/:discipline/:simuladoNumber", authMiddleware, simuladoController.getSimuladoDetails);
router.post("/historico/disciplina", authMiddleware, simuladoController.getSimuladosByDiscipline);
router.post("/historico/detalhes", authMiddleware, simuladoController.getSimuladoDetailsById);

module.exports = router;
