const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendEmail } = require("../utils/emailHelper");
const logger = require("../utils/logger");

exports.registerUser = async (req, res) => {
  try {
    const { completeName, email, password, confirmPassword, category } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "As senhas não coincidem." });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "A senha deve ter pelo menos 8 caracteres, incluindo letras maiúsculas, minúsculas, números e caracteres especiais.",
      });
    }

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "Usuário já existe" });

    const newUser = new User({ completeName, email, password, category });
    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.status(201).json({ token });
  } catch (error) {
    console.error(`Erro ao registrar usuário: ${error.message}`);
    res.status(500).json({ message: "Erro ao registrar usuário.", error: error.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`Tentativa de login com email não cadastrado: ${email}`);
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.warn(`Senha incorreta para o usuário: ${email}`);
      return res.status(400).json({ message: "Senha incorreta." });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
    logger.info(`Usuário logado: ${email}`);
    res.status(200).json({ token, message: "Login realizado com sucesso." });
  } catch (error) {
    logger.error(`Erro ao fazer login: ${error.message}`);
    res.status(500).json({ message: "Erro ao fazer login." });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      logger.error("Tentativa de envio de email sem destinatário.");
      return res.status(400).json({ message: "Email inválido." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`Tentativa de recuperação de senha para email não cadastrado: ${email}`);
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const resetCode = crypto.randomInt(100000, 999999).toString();
    user.resetPasswordCode = resetCode;
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
    await user.save();

    const emailContent = `
      Olá, ${user.completeName}.

      Você solicitou a redefinição da sua senha. Use o código abaixo para criar uma nova senha:

      Código: ${resetCode}

      Este código é válido por 30 minutos.

      Se você não solicitou essa redefinição, ignore este email.
    `;

    await sendEmail({
      to: email,
      subject: "Seu Código de Redefinição de Senha - Gabaritaê",
      text: emailContent,
    });

    logger.info(`Email de redefinição enviado para: ${email}`);
    res.status(200).json({ message: "Email enviado com sucesso!" });
  } catch (error) {
    logger.error(`Erro ao processar solicitação de redefinição de senha: ${error.message}`);
    res.status(500).json({ message: "Erro ao processar solicitação." });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      logger.warn(`Tentativa de redefinição de senha com senhas não coincidentes: ${email}`);
      return res.status(400).json({
        message: "A nova senha e a confirmação da senha não coincidem.",
      });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!passwordRegex.test(newPassword)) {
      logger.warn(`Tentativa de redefinir senha com senha fraca: ${email}`);
      return res.status(400).json({
        message:
          "A nova senha deve ter pelo menos 8 caracteres, incluindo uma letra maiúscula, uma letra minúscula, um número e um caractere especial.",
      });
    }

    const user = await User.findOne({
      email,
      resetPasswordCode: code,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      logger.warn(`Tentativa de redefinição com código inválido/expirado: ${email}`);
      return res.status(400).json({ message: "Código inválido ou expirado." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    logger.info(`Senha redefinida com sucesso para: ${email}`);
    res.status(200).json({ message: "Senha redefinida com sucesso." });
  } catch (error) {
    logger.error(`Erro ao redefinir senha: ${error.message}`);
    res.status(500).json({ message: "Erro ao redefinir senha.", error: error.message });
  }
};
