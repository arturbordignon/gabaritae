const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

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
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model("User", userSchema);
