const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const alternativeSchema = new mongoose.Schema({
  letter: { type: String, required: true },
  text: { type: String, default: "Alternativa sem texto" },
  file: String,
});

const questionSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  index: { type: Number, required: true },
  year: { type: Number, required: true },
  title: { type: String, default: "" },
  context: { type: String, default: "" },
  files: [String],
  alternatives: [alternativeSchema],
  correctAlternative: { type: String, default: "" },
  userAnswer: String,
  isCorrect: Boolean,
  responseTime: Number,
  answeredAt: Date,
});

const simuladoAttemptSchema = new mongoose.Schema({
  discipline: { type: String, required: true },
  simuladoNumber: { type: Number, required: true },
  year: { type: Number, required: true },
  questions: [questionSchema],
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  status: {
    type: String,
    enum: ["active", "completed", "failed"],
    default: "active",
  },
  score: { type: Number, default: 0 },
});

const userSchema = new mongoose.Schema({
  completeName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  profilePicture: { type: String },
  category: { type: String, enum: ["ENEM"], required: true },
  resetPasswordCode: { type: String },
  resetPasswordExpire: { type: Date },
  vidas: { type: Number, default: 10 },
  proximaVida: { type: Date },
  points: { type: Number, default: 0 },
  offsets: {
    matematica: { type: Number, default: 0 },
    linguagens: { type: Number, default: 0 },
    "ciencias-humanas": { type: Number, default: 0 },
    "ciencias-natureza": { type: Number, default: 0 },
  },
  simuladoAttempts: [simuladoAttemptSchema],
  currentSimulado: {
    attemptId: mongoose.Schema.Types.ObjectId,
    questionIndex: Number,
    startedAt: Date,
  },
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model("User", userSchema);
