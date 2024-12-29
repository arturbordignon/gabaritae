const User = require("../models/User");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { completeName } = req.body;
    let profilePicture;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "gabaritae/profile_pictures",
        use_filename: true,
      });
      profilePicture = result.secure_url;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    user.completeName = completeName || user.completeName;
    user.profilePicture = profilePicture || user.profilePicture;

    await user.save();

    res.status(200).json({ message: "Perfil atualizado com sucesso.", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
};
