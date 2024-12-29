const axios = require("axios");
const User = require("../models/User");
const moment = require("moment");

const recarregarVidas = async (user) => {
  const now = moment();
  if (user.proximaVida && now.isSameOrAfter(user.proximaVida)) {
    const proximaVidaMoment = moment(user.proximaVida);
    const horasDecorridas = now.diff(proximaVidaMoment, "hours");
    const vidasRecuperadas = Math.floor(horasDecorridas / 3);
    user.vidas = Math.min(10, user.vidas + vidasRecuperadas);
    user.proximaVida = user.vidas < 10 ? now.add(3, "hours").toDate() : null;
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

    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    await recarregarVidas(user);

    const simuladosRealizados = user.simulados.reduce((acc, simulado) => {
      const { year, discipline, simuladoNumber, questions } = simulado;
      const status = questions.length === 10 ? "completo" : "incompleto";
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push({ discipline, simuladoNumber, status });
      return acc;
    }, {});

    res.status(200).json({
      topics: response.data,
      simuladosRealizados,
      vidasRestantes: user.vidas,
    });
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
          files: question.files,
          alternativesIntroduction: question.alternativesIntroduction,
          alternatives: question.alternatives.map((alt) => ({
            letter: alt.letter,
            text: alt.text,
            file: alt.file,
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
      files: question.files,
      alternativesIntroduction: question.alternativesIntroduction,
      alternatives: question.alternatives.map((alt) => ({
        letter: alt.letter,
        text: alt.text,
        file: alt.file,
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

    const simuladosTerminados = user.simulados.filter(
      (simulado) => simulado.questions.length === 10
    ).length;

    const simulados = user.simulados.slice(0, 10);

    res.status(200).json({ simulados, simuladosTerminados });
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

exports.getSimuladoStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    await recarregarVidas(user);

    const simuladosTerminados = user.simulados.filter(
      (simulado) => simulado.questions.length === 10
    ).length;

    const simulados = user.simulados.slice(0, 10);

    const response = await axios.get("https://api.enem.dev/v1/exams");
    const anosDisponiveis = response.data.map((exam) => exam.year);

    res.status(200).json({
      anosDisponiveis,
      simulados,
      simuladosTerminados,
      vidasRestantes: user.vidas,
      proximaVida: user.proximaVida,
    });
  } catch (error) {
    console.error(`Erro ao buscar status do simulado: ${error.message}`);
    res.status(500).json({ message: "Erro ao buscar status do simulado.", error: error.message });
  }
};
