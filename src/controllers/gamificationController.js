const User = require("../models/User");

exports.getUserLevelAndPoints = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const level = Math.floor(user.points / 20) + 1;
    res.status(200).json({ level, points: user.points });
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar dados de gamificação.", error: error.message });
  }
};

exports.updatePoints = async (req, res) => {
  try {
    const { pointsEarned } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    user.points += pointsEarned;
    await user.save();

    res.status(200).json({ message: "Pontos atualizados com sucesso.", points: user.points });
  } catch (error) {
    res.status(500).json({ message: "Erro ao atualizar pontos.", error: error.message });
  }
};
