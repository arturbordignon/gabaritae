const express = require("express");
const {
  listTopics,
  getQuestionsByYearAndDiscipline,
  getQuestion,
  checkAnswer,
  checkVidas,
} = require("../controllers/simuladoController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/topics", listTopics);
router.post("/questions", getQuestionsByYearAndDiscipline);
router.post("/question", authMiddleware, getQuestion);
router.post("/check-answer", authMiddleware, checkAnswer);
router.get("/check-vidas", authMiddleware, checkVidas);

module.exports = router;
