const SimuladoHistory = require("../models/SimuladoHistory");

exports.saveExamHistory = async (req, res) => {
  try {
    const { questions, totalQuestions, correctAnswers, incorrectAnswers, totalTime } = req.body;

    const newHistory = new SimuladoHistory({
      userId: req.user.id,
      questions,
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      totalTime,
    });

    await newHistory.save();

    res.status(200).json({ message: "Histórico salvo com sucesso." });
  } catch (error) {
    res.status(500).json({ message: "Erro ao salvar histórico.", error: error.message });
  }
};

exports.getUserHistory = async (req, res) => {
  try {
    const histories = await SimuladoHistory.find({ userId: req.user.id });

    res.status(200).json({ histories });
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar histórico.", error: error.message });
  }
};
