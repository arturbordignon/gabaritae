const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const alternativeSchema = new mongoose.Schema({
  letter: { type: String, required: true },
  text: { type: String, required: true },
  file: { type: String },
  isCorrect: { type: Boolean, required: true },
});

const questionSchema = new mongoose.Schema({
  questionId: { type: Number, required: true },
  title: { type: String, required: true },
  context: { type: String, required: true },
  files: [{ type: String }],
  alternativesIntroduction: { type: String },
  alternatives: [alternativeSchema],
  userAnswer: { type: String, required: true },
  correctAnswer: { type: String, required: true },
  responseTime: { type: Number, required: true },
});

const simuladoSchema = new mongoose.Schema({
  year: { type: Number, required: true },
  discipline: { type: String, required: true },
  simuladoNumber: { type: Number, required: true },
  questions: [questionSchema],
});

const userSchema = new mongoose.Schema({
  completeName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  profilePicture: { type: String },
  category: { type: String, enum: ["ENEM"], required: true },
  resetPasswordCode: { type: String },
  resetPasswordExpire: { type: Date },
  vidas: {
    type: Number,
    default: 10,
    min: 0,
    max: 10,
  },
  proximaVida: {
    type: Date,
    default: null,
  },
  points: { type: Number, default: 0 },
  offsets: {
    matematica: { type: Number, default: 0 },
    linguagens: { type: Number, default: 0 },
    "ciencias-humanas": { type: Number, default: 0 },
    "ciencias-natureza": { type: Number, default: 0 },
  },
  simulados: [simuladoSchema],
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model("User", userSchema);
