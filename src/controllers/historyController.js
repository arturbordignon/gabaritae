const axios = require("axios");
const SimuladoHistory = require("../models/SimuladoHistory");
const User = require("../models/User");
const pLimit = require("p-limit");

const CONCURRENCY_LIMIT = 5;
const limit = pLimit(CONCURRENCY_LIMIT);

exports.saveExamHistory = async (req, res) => {
  try {
    const { questions, totalQuestions, correctAnswers, incorrectAnswers, totalTime } = req.body;

    const enrichedQuestions = await Promise.all(
      questions.map((question) =>
        limit(async () => {
          try {
            const response = await axios.get(
              `https://api.enem.dev/v1/questions/${question.questionId}`
            );
            return {
              ...question,
              title: response.data.title || "Título não disponível",
              context: response.data.context || "Contexto não disponível",
              alternatives: response.data.alternatives || [],
            };
          } catch (err) {
            console.error(
              `Erro ao buscar detalhes para a questão ${question.questionId}: ${err.message}`
            );
            return { ...question, title: "Erro", context: "Erro", alternatives: [] };
          }
        })
      )
    );

    const newHistory = new SimuladoHistory({
      userId: req.user.id,
      questions: enrichedQuestions,
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      totalTime,
    });

    await newHistory.save();

    const pointsEarned = correctAnswers;
    const user = await User.findById(req.user.id);
    user.points += pointsEarned;
    await user.save();

    const newLevel = Math.floor(user.points / 20) + 1;

    res.status(201).json({
      message: "Histórico salvo com sucesso.",
      pointsEarned,
      newLevel,
    });
  } catch (error) {
    console.error(`Erro ao salvar histórico: ${error.message}`);
    res.status(500).json({ message: "Erro ao salvar histórico.", error: error.message });
  }
};

exports.getUserHistory = async (req, res) => {
  try {
    const histories = await SimuladoHistory.find({ userId: req.user.id });

    if (!histories.length) {
      return res.status(200).json({ message: "Nenhum histórico encontrado.", histories: [] });
    }

    res.status(200).json({ histories });
  } catch (error) {
    console.error(`Erro ao buscar histórico: ${error.message}`);
    res.status(500).json({ message: "Erro ao buscar histórico.", error: error.message });
  }
};

exports.getUserSimuladoHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const history = await SimuladoHistory.find({ userId });

    if (!history.length) {
      return res.status(200).json({ message: "Nenhum histórico encontrado.", history: [] });
    }

    const enrichedHistory = await Promise.all(
      history.map(async (entry) => {
        const enrichedQuestions = await Promise.all(
          entry.questions.map((question) =>
            limit(async () => {
              try {
                const response = await axios.get(
                  `https://api.enem.dev/v1/questions/${question.questionId}`
                );
                return {
                  ...question.toObject(),
                  title: response.data.title || "Título não disponível",
                  context: response.data.context || "Contexto não disponível",
                  alternatives: response.data.alternatives || [],
                };
              } catch (err) {
                console.error(
                  `Erro ao buscar detalhes para a questão ${question.questionId}: ${err.message}`
                );
                return { ...question.toObject(), title: "Erro", context: "Erro", alternatives: [] };
              }
            })
          )
        );

        return { ...entry.toObject(), questions: enrichedQuestions };
      })
    );

    res.status(200).json(enrichedHistory);
  } catch (error) {
    console.error(`Erro ao buscar histórico detalhado: ${error.message}`);
    res.status(500).json({ message: "Erro ao buscar histórico detalhado.", error: error.message });
  }
};
