const mongoose = require("mongoose");

const alternativeSchema = new mongoose.Schema({
  letter: { type: String, required: true },
  text: { type: String, required: true },
  isCorrect: { type: Boolean, required: true },
});

const questionSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  numeroQuestao: { type: Number, required: true },
  discipline: { type: String, required: true },
  correct: { type: Boolean, required: true },
  responseTime: { type: Number, required: true },
  userAnswer: { type: String, required: true },
  correctAnswer: { type: String, required: true },
  title: { type: String, required: false },
  context: { type: String, required: false },
  alternatives: [alternativeSchema],
});

const simuladoHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  examDate: { type: Date, default: Date.now },
  questions: [questionSchema],
  totalQuestions: { type: Number, required: true },
  correctAnswers: { type: Number, required: true },
  incorrectAnswers: { type: Number, required: true },
  totalTime: { type: Number, required: true },
});

module.exports = mongoose.model("SimuladoHistory", simuladoHistorySchema);
