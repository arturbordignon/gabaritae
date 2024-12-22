const User = require("../models/User");

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar perfil.", error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { completeName, profilePicture } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    user.completeName = completeName || user.completeName;
    user.profilePicture = profilePicture || user.profilePicture;

    await user.save();

    res.status(200).json({ message: "Perfil atualizado com sucesso.", user });
  } catch (error) {
    res.status(500).json({ message: "Erro ao atualizar perfil.", error: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Senha antiga incorreta." });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Senha alterada com sucesso." });
  } catch (error) {
    res.status(500).json({ message: "Erro ao alterar senha.", error: error.message });
  }
};
