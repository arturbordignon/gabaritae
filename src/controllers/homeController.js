const User = require("../models/User");

exports.getHomeDetails = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const level = Math.floor(user.points / 20) + 1;

    res.status(200).json({
      completeName: user.completeName,
      vidas: user.vidas,
      points: user.points,
      level,
    });
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar dados da home.", error: error.message });
  }
};
