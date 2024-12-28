const axios = require("axios");
const User = require("../models/User");

exports.listTopics = async (req, res) => {
  try {
    const response = await axios.get("https://api.enem.dev/v1/exams");
    if (!response.data || response.data.length === 0) {
      return res.status(404).json({ message: "Nenhum tópico encontrado." });
    }

    res.status(200).json({ topics: response.data });
  } catch (error) {
    console.error("Erro ao listar tópicos:", error.message);
    res.status(500).json({ message: "Erro ao listar tópicos.", error: error.message });
  }
};

exports.getQuestion = async (req, res) => {
  try {
    const { year, discipline } = req.body;
    const userId = req.user.id;

    const disciplineOffsets = {
      matematica: 150,
      linguagens: 0,
      "ciencias-humanas": 46,
      "ciencias-natureza": 100,
    };

    if (!disciplineOffsets.hasOwnProperty(discipline)) {
      return res.status(400).json({ message: "Disciplina não reconhecida." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const offset = user.offsets[discipline];
    const questionOffset = disciplineOffsets[discipline] + offset;
    const response = await axios.get(
      `https://api.enem.dev/v1/exams/${year}/questions/${questionOffset}`
    );

    if (!response.data) {
      return res.status(404).json({ message: "Questão não encontrada." });
    }

    const question = {
      id: response.data.index,
      title: response.data.title,
      context: response.data.context,
      alternatives: response.data.alternatives.map((alt) => ({
        letter: alt.letter,
        text: alt.text,
      })),
    };

    user.offsets[discipline] += 1;
    await user.save();

    res.status(200).json({ question, questionNumber: questionOffset });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ message: "Questão não encontrada." });
    }
    console.error(`Erro ao buscar questão: ${error.message}`);
    res.status(500).json({ message: "Erro ao buscar questão.", error: error.message });
  }
};

exports.getQuestionsByYearAndDiscipline = async (req, res) => {
  try {
    const { year, discipline } = req.body;

    if (!year || !discipline) {
      return res.status(400).json({ message: "Ano e disciplina são obrigatórios." });
    }

    const disciplineOffsets = {
      matematica: 150,
      linguagens: 0,
      "ciencias-humanas": 46,
      "ciencias-natureza": 100,
    };

    if (!disciplineOffsets.hasOwnProperty(discipline)) {
      return res.status(400).json({ message: "Disciplina não reconhecida." });
    }

    const offset = disciplineOffsets[discipline];
    const url = `https://api.enem.dev/v1/exams/${year}/questions?offset=${offset}&limit=50`;

    const response = await axios.get(url);

    if (!response.data || response.data.questions.length === 0) {
      return res.status(404).json({ message: "Nenhuma questão encontrada." });
    }

    const questions = response.data.questions.map((question, index) => ({
      id: offset + index + 1, // Adjusting ID based on offset
      title: question.title,
      context: question.context,
      alternatives: question.alternatives.map((alt) => ({
        letter: alt.letter,
        text: alt.text,
      })),
    }));

    res.status(200).json({ questions });
  } catch (error) {
    console.error("Erro ao buscar questões:", error.message);
    res.status(500).json({ message: "Erro ao buscar questões.", error: error.message });
  }
};

exports.checkAnswer = async (req, res) => {
  try {
    const { year, questionNumber, userAnswer } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    if (user.vidas <= 0) {
      return res.status(400).json({
        message: "Sem vidas disponíveis.",
        nextLife: user.proximaVida,
      });
    }

    const response = await axios.get(
      `https://api.enem.dev/v1/exams/${year}/questions/${questionNumber}`
    );
    const question = response.data;

    if (!question) {
      return res.status(404).json({ message: "Questão não encontrada." });
    }

    const correctAnswer = question.alternatives.find((alt) => alt.isCorrect).letter;
    const isCorrect = userAnswer === correctAnswer;

    if (!isCorrect) {
      user.vidas -= 1;
      user.points = Math.max(0, user.points - 1);

      if (user.vidas === 0) {
        user.proximaVida = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
    } else {
      user.points += 1;
    }

    await user.save();

    return res.status(200).json({
      correct: isCorrect,
      correctAnswer,
      vidasRestantes: user.vidas,
      points: user.points,
      proximaVida: user.proximaVida,
    });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ message: "Questão não encontrada." });
    }
    console.error(`Erro ao verificar resposta: ${error.message}`);
    res.status(500).json({ message: "Erro ao verificar resposta.", error: error.message });
  }
};

exports.checkVidas = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    if (user.vidas === 0 && user.proximaVida && user.proximaVida <= new Date()) {
      user.vidas = 10;
      user.proximaVida = null;
      await user.save();
    }

    res.status(200).json({
      vidas: user.vidas,
      proximaVida: user.proximaVida,
    });
  } catch (error) {
    console.error(`Erro ao verificar vidas: ${error.message}`);
    res.status(500).json({ message: "Erro ao verificar vidas." });
  }
};
