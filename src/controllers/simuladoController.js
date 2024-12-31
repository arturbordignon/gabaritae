const axios = require("axios");
const User = require("../models/User");
const moment = require("moment");

const QUESTIONS_PER_SIMULADO = 10;
const MAX_SIMULADOS_PER_DISCIPLINE = 10;
const SIMULADO_TIME_LIMIT_SECONDS = 50 * 60;

const disciplineOffsets = {
  matematica: 150,
  linguagens: 0,
  "ciencias-humanas": 46,
  "ciencias-natureza": 100,
};

const fetchQuestions = async (year, discipline) => {
  try {
    const offset = disciplineOffsets[discipline];
    const apiUrl = `https://api.enem.dev/v1/exams/${year}/questions`;

    const response = await axios.get(apiUrl, {
      params: {
        limit: QUESTIONS_PER_SIMULADO,
        offset: offset,
      },
    });

    if (!response.data || !response.data.questions) {
      throw new Error("Invalid response format from API");
    }

    console.log("Raw API Response:", JSON.stringify(response.data.questions[2], null, 2));

    const questions = response.data.questions.slice(0, QUESTIONS_PER_SIMULADO);

    return questions.map((question, index) => ({
      questionId: question.index.toString(),
      index: question.index,
      year: question.year,
      title: question.title || `Questão ${question.index} - ENEM ${question.year}`,
      context: question.context || "",
      files: question.files || [],
      alternativesIntroduction:
        question.alternativesIntroduction || "Com base no texto, selecione a alternativa correta",
      alternatives: question.alternatives
        .map((alt) => ({
          letter: alt.letter,
          text: alt.text || "Alternativa sem texto",
          file: alt.file || null,
        }))
        .filter((alt) => alt.letter),
      correctAlternative: question.correctAlternative,
    }));
  } catch (error) {
    console.error("API Request failed:", error.response?.data || error.message);
    throw error;
  }
};

exports.startSimulado = async (req, res) => {
  try {
    const { year, discipline } = req.body;
    const user = await User.findById(req.user.id);

    if (user.vidas < 1) {
      return res
        .status(403)
        .json({ message: "Sem vidas disponíveis", proximaVida: user.proximaVida });
    }

    const completedCount = user.simuladoAttempts[discipline].filter(
      (s) => s.status === "completed"
    ).length;

    if (completedCount >= MAX_SIMULADOS_PER_DISCIPLINE) {
      return res.status(400).json({ message: "Limite de simulados atingido" });
    }

    const questions = await fetchQuestions(year, discipline);

    const attempt = {
      discipline,
      simuladoNumber: completedCount + 1,
      year,
      questions: questions.map((q) => ({
        questionId: q.questionId,
        index: q.index,
        year: q.year,
        title: q.title || `Questão ${q.index} - ENEM ${q.year}`,
        context: q.context || "",
        files: q.files || [],
        alternativesIntroduction:
          q.alternativesIntroduction || "Com base no texto, selecione a alternativa correta",
        alternatives: q.alternatives.map((alt) => ({
          letter: alt.letter,
          text: alt.text,
          file: alt.file || null,
        })),
        correctAlternative: q.correctAlternative, // Required field
      })),
      startedAt: new Date(),
      status: "active",
    };

    // Debug log
    console.log("Question structure:", attempt.questions[0]);

    user.simuladoAttempts[discipline].push(attempt);
    await user.save();

    const attemptId =
      user.simuladoAttempts[discipline][user.simuladoAttempts[discipline].length - 1]._id;

    user.currentSimulado = {
      attemptId,
      questionIndex: 0,
      startedAt: new Date(),
      discipline,
    };

    await user.save();

    const clientQuestions = questions.map(({ correctAlternative, ...q }) => q);

    return res.json({
      simuladoId: attemptId,
      vidas: user.vidas,
      simuladoNumber: attempt.simuladoNumber,
      questions: clientQuestions,
    });
  } catch (error) {
    console.error("Start simulado error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.submitAnswer = async (req, res) => {
  try {
    const { questionId, userAnswer } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.currentSimulado) {
      return res.status(404).json({ message: "Nenhum simulado ativo" });
    }

    const { discipline } = user.currentSimulado;
    let currentAttempt = user.simuladoAttempts[discipline].find(
      (attempt) => attempt._id.toString() === user.currentSimulado.attemptId.toString()
    );

    if (!currentAttempt) {
      return res.status(404).json({ message: "Simulado não encontrado" });
    }

    // Debug logging
    console.log("Debug info:", {
      currentSimulado: user.currentSimulado,
      questionId,
      totalQuestions: currentAttempt.questions.length,
      questions: currentAttempt.questions.map((q) => q.questionId),
    });

    // Initialize questionIndex if undefined
    if (user.currentSimulado.questionIndex === undefined) {
      user.currentSimulado.questionIndex = 0;
    }

    // Validate question sequence
    const questionIndex = currentAttempt.questions.findIndex((q) => q.questionId === questionId);
    if (questionIndex === -1) {
      return res.status(404).json({ message: "Questão não encontrada" });
    }
    if (questionIndex !== user.currentSimulado.questionIndex) {
      return res.status(400).json({
        message: "Questão fora de ordem",
        expectedQuestionId: currentAttempt.questions[user.currentSimulado.questionIndex].questionId,
        currentQuestionIndex: user.currentSimulado.questionIndex,
      });
    }

    // Validate question index
    if (user.currentSimulado.questionIndex >= currentAttempt.questions.length) {
      return res.status(400).json({
        message: "Índice de questão inválido",
        currentIndex: user.currentSimulado.questionIndex,
        totalQuestions: currentAttempt.questions.length,
      });
    }

    // Get current question
    const currentQuestion = currentAttempt.questions[user.currentSimulado.questionIndex];

    if (!currentQuestion) {
      return res.status(404).json({
        message: "Questão não encontrada",
        questionId,
        index: user.currentSimulado.questionIndex,
      });
    }

    // Validate if already answered
    if (currentQuestion.userAnswer) {
      return res.status(400).json({
        message: "Esta questão já foi respondida",
        currentQuestionIndex: user.currentSimulado.questionIndex,
      });
    }

    // Process answer
    const isCorrect = userAnswer === currentQuestion.correctAlternative;
    currentQuestion.userAnswer = userAnswer;
    currentQuestion.isCorrect = isCorrect;
    currentQuestion.answeredAt = new Date();

    // Handle incorrect answer
    if (!isCorrect) {
      user.vidas -= 1;

      if (user.vidas <= 0) {
        const proximaVida = new Date();
        proximaVida.setHours(proximaVida.getHours() + 3);
        user.proximaVida = proximaVida;

        // Remove current simulado
        user.simuladoAttempts[discipline] = user.simuladoAttempts[discipline].filter(
          (attempt) => attempt._id.toString() !== currentAttempt._id.toString()
        );
        user.currentSimulado = null;
        await user.save();

        return res.status(400).json({
          message: "Você perdeu todas as vidas! Tente novamente mais tarde.",
          vidasRestantes: 0,
          proximaVida: proximaVida,
        });
      }
    }

    // Check if simulado is complete
    const isComplete = user.currentSimulado.questionIndex === currentAttempt.questions.length - 1;

    if (isComplete) {
      currentAttempt.completedAt = new Date();
      currentAttempt.status = "completed";
      currentAttempt.score = currentAttempt.questions.filter((q) => q.isCorrect).length;
      user.currentSimulado = null;
      await user.save();

      return res.json({
        correct: isCorrect,
        vidasRestantes: user.vidas,
        isComplete: true,
        currentQuestionIndex: null,
        answer: {
          userAnswer,
          correctAnswer: currentQuestion.correctAlternative,
          explanation: isCorrect
            ? "Resposta correta!"
            : `A alternativa correta é ${currentQuestion.correctAlternative}`,
        },
        message: "Você terminou este simulado!",
      });
    } else {
      user.currentSimulado.questionIndex += 1;
      await user.save();

      return res.json({
        correct: isCorrect,
        vidasRestantes: user.vidas,
        isComplete: false,
        currentQuestionIndex: user.currentSimulado.questionIndex,
        answer: {
          userAnswer,
          correctAnswer: currentQuestion.correctAlternative,
          explanation: isCorrect
            ? "Resposta correta!"
            : `A alternativa correta é ${currentQuestion.correctAlternative}`,
        },
      });
    }
  } catch (error) {
    console.error("Submit answer error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getSimuladoStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.currentSimulado) {
      return res.json({ active: false });
    }

    return res.json({
      active: true,
      simuladoNumber: user.currentSimulado.simuladoNumber,
      currentQuestion: user.currentSimulado.questionIndex + 1,
      vidas: user.vidas,
      discipline: user.currentSimulado.discipline,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSimuladoDetails = async (req, res) => {
  try {
    const { discipline, simuladoNumber } = req.params;
    const user = await User.findById(req.user.id);

    const simulado = user.simuladoAttempts[discipline].find(
      (s) => s.simuladoNumber === parseInt(simuladoNumber)
    );

    if (!simulado) {
      return res.status(404).json({ message: "Simulado não encontrado" });
    }

    return res.json(simulado);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getExams = async (req, res) => {
  try {
    const response = await axios.get("https://api.enem.dev/v1/exams");

    const exams = response.data || [];

    if (!exams.length) {
      return res.status(404).json({ message: "Nenhuma prova encontrado" });
    }

    return res.json(exams);
  } catch (error) {
    console.error("Erro ao gerar provas:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    if (error.response?.status === 404) {
      return res.status(404).json({ message: "Endpoint não encontrado" });
    }

    res.status(500).json({ message: "Erro ao buscar provas" });
  }
};
