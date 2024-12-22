const express = require("express");
const {
  listTopics,
  getQuestionsByYearAndDiscipline,
} = require("../controllers/simuladoController");

const router = express.Router();

router.get("/topics", listTopics);
router.post("/questions", getQuestionsByYearAndDiscipline);

module.exports = router;
