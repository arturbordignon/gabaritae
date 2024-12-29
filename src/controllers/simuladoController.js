const axios = require("axios");
const User = require("../models/User");
const moment = require("moment");

const recarregarVidas = async (user) => {
  const now = moment();
  console.log(`Current time: ${now.toISOString()}`);
  if (user.proximaVida && now.isSameOrAfter(user.proximaVida)) {
    const proximaVidaMoment = moment(user.proximaVida);
    console.log(`Proxima vida: ${proximaVidaMoment.toISOString()}`);
    const vidasRecuperadas = Math.floor(now.diff(proximaVidaMoment, "hours") / 3);
    console.log(`Vidas recuperadas: ${vidasRecuperadas}`);
    user.vidas = Math.min(10, user.vidas + vidasRecuperadas);
    user.proximaVida = user.vidas < 10 ? now.add(3, "hours").toDate() : null;
    console.log(`Nova proxima vida: ${user.proximaVida}`);
    await user.save();
  } else {
    console.log("Não é hora de recarregar vidas ainda.");
  }
};

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

exports.getSimulado = async (req, res) => {
  try {
    const { year, discipline, simuladoNumber, userAnswer, responseTime } = req.body;
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

    await recarregarVidas(user);

    if (user.vidas <= 0) {
      return res.status(400).json({
        message: "Sem vidas disponíveis.",
        proximaVida: user.proximaVida,
      });
    }

    const offset = user.offsets[discipline];
    const questionOffset = disciplineOffsets[discipline] + offset;
    const response = await axios.get(
      `https://api.enem.dev/v1/exams/${year}/questions/${questionOffset}`
    );
    const question = response.data;

    if (!question) {
      return res.status(404).json({ message: "Questão não encontrada." });
    }

    if (userAnswer === null) {
      return res.status(200).json({
        question: {
          id: question.index,
          title: question.title,
          context: question.context,
          alternatives: question.alternatives.map((alt) => ({
            letter: alt.letter,
            text: alt.text,
          })),
        },
        questionNumber: questionOffset,
      });
    }

    const correctAnswer = question.alternatives.find((alt) => alt.isCorrect).letter;
    const isCorrect = userAnswer === correctAnswer;

    if (!isCorrect) {
      user.vidas -= 1;
      user.points = Math.max(0, user.points - 1);

      if (user.vidas === 0) {
        user.proximaVida = moment().add(3, "hours").toDate();
      }
    } else {
      user.points += 1;
    }

    let simulado = user.simulados.find(
      (s) => s.year === year && s.discipline === discipline && s.simuladoNumber === simuladoNumber
    );
    if (!simulado) {
      simulado = { year, discipline, simuladoNumber, questions: [] };
      user.simulados.push(simulado);
    }

    simulado.questions.push({
      questionId: question.index,
      title: question.title,
      context: question.context,
      alternatives: question.alternatives.map((alt) => ({
        letter: alt.letter,
        text: alt.text,
        isCorrect: alt.isCorrect,
      })),
      userAnswer: userAnswer,
      correctAnswer: correctAnswer,
      responseTime: responseTime,
    });

    user.offsets[discipline] += 1;
    await user.save();

    res.status(200).json({
      correct: isCorrect,
      correctAnswer: correctAnswer,
      vidasRestantes: user.vidas,
      points: user.points,
      proximaVida: user.proximaVida,
    });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ message: "Questão não encontrada." });
    }
    console.error(`Erro ao buscar questão: ${error.message}`);
    res.status(500).json({ message: "Erro ao buscar questão.", error: error.message });
  }
};

exports.getUserSimuladoHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    res.status(200).json({ simulados: user.simulados });
  } catch (error) {
    console.error(`Erro ao buscar histórico: ${error.message}`);
    res.status(500).json({ message: "Erro ao buscar histórico.", error: error.message });
  }
};

exports.checkVidas = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    await recarregarVidas(user);

    res.status(200).json({
      vidas: user.vidas,
      proximaVida: user.proximaVida,
    });
  } catch (error) {
    console.error(`Erro ao verificar vidas: ${error.message}`);
    res.status(500).json({ message: "Erro ao verificar vidas.", error: error.message });
  }
};
