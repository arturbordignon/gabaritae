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
    const { year, discipline, language } = req.body;
    const user = await User.findById(req.user.id);

    if (typeof user.points === "undefined") user.points = 0;
    if (typeof user.level === "undefined") user.level = 1;

    let disciplineKey = discipline;
    if (discipline === "linguagens") {
      if (!language || !["ingles", "espanhol"].includes(language)) {
        return res.status(400).json({
          message: "Idioma inválido ou não especificado para disciplina de linguagens",
        });
      }
      disciplineKey = `linguagens-${language}`;
    }

    const hasActiveSimulado = Object.values(user.simuladoAttempts || {}).some((attempts) =>
      attempts?.some((s) => s.status === "active")
    );

    if (hasActiveSimulado) {
      return res.status(400).json({
        message: "Você já tem um simulado em andamento",
      });
    }

    if (user.vidas < 1) {
      if (user.simuladoAttempts[disciplineKey]) {
        user.simuladoAttempts[disciplineKey] = user.simuladoAttempts[disciplineKey].filter(
          (s) => s.status === "completed"
        );
      }

      const proximaVida = new Date();
      proximaVida.setHours(proximaVida.getHours() + 3);
      user.proximaVida = proximaVida;

      await user.save();

      return res.status(403).json({
        message: "Sem vidas disponíveis",
        proximaVida: user.proximaVida,
      });
    }

    if (!user.simuladoAttempts[disciplineKey]) {
      user.simuladoAttempts[disciplineKey] = [];
    }

    const completedCount = user.simuladoAttempts[disciplineKey].filter(
      (s) => s.status === "completed"
    ).length;

    if (completedCount >= MAX_SIMULADOS_PER_DISCIPLINE) {
      return res.status(400).json({ message: "Limite de simulados atingido" });
    }

    const questions = await fetchQuestions(year, discipline);

    const attempt = {
      discipline: disciplineKey,
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
        correctAlternative: q.correctAlternative,
      })),
      startedAt: new Date(),
      status: "active",
    };

    user.simuladoAttempts[disciplineKey].push(attempt);
    await user.save();

    const attemptId =
      user.simuladoAttempts[disciplineKey][user.simuladoAttempts[disciplineKey].length - 1]._id;

    user.currentSimulado = {
      attemptId,
      questionIndex: 0,
      startedAt: new Date(),
      discipline: disciplineKey,
    };

    await user.save();

    const clientQuestions = questions.map(({ correctAlternative, ...q }) => q);

    return res.json({
      simuladoId: attemptId,
      vidas: user.vidas,
      points: user.points,
      level: user.level,
      simuladoNumber: attempt.simuladoNumber,
      questions: clientQuestions,
    });
  } catch (error) {
    console.error("Erro ao começar simulado:", error);
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

    const isCorrect = userAnswer === currentQuestion.correctAlternative;
    currentQuestion.userAnswer = userAnswer;
    currentQuestion.isCorrect = isCorrect;
    currentQuestion.answeredAt = new Date();

    if (isCorrect) {
      user.points = (user.points || 0) + 1;
      const newLevel = Math.floor(user.points / 15) + 1;
      if (newLevel > user.level) {
        user.level = newLevel;
      }
    } else {
      if (user.points > 0) {
        user.points -= 1;
      }
      user.vidas -= 1;

      if (user.vidas <= 0) {
        const proximaVida = new Date();
        proximaVida.setHours(proximaVida.getHours() + 3);
        user.proximaVida = proximaVida;

        user.simuladoAttempts = user.simuladoAttempts.filter(
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

    const isComplete = user.currentSimulado.questionIndex === currentAttempt.questions.length - 1;

    if (isComplete) {
      currentAttempt.completedAt = new Date();
      currentAttempt.status = "completed";
      currentAttempt.score = currentAttempt.questions.filter((q) => q.isCorrect).length;

      user.points += 0;
      user.currentSimulado = null;
    } else {
      user.currentSimulado.questionIndex += 1;
    }

    await user.save();

    return res.json({
      correct: isCorrect,
      vidasRestantes: user.vidas,
      pointsEarned: isCorrect ? 1 : user.points > 0 ? -1 : 0,
      currentPoints: user.points,
      level: user.level,
      isComplete,
      currentQuestionIndex: isComplete ? null : user.currentSimulado.questionIndex,
      answer: {
        userAnswer,
        correctAnswer: currentQuestion.correctAlternative,
        explanation: isCorrect
          ? "Resposta correta!"
          : `A alternativa correta é ${currentQuestion.correctAlternative}`,
      },
    });
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

exports.getSimuladosByDiscipline = async (req, res) => {
  try {
    const { discipline } = req.body;
    const user = await User.findById(req.user.id);

    const validDisciplines = ["matematica", "linguagens", "ciencias-humanas", "ciencias-natureza"];
    if (!validDisciplines.includes(discipline)) {
      return res.status(400).json({
        message: "Disciplina inválida",
      });
    }

    const disciplineSimulados = user.simuladoAttempts[discipline] || [];

    if (!disciplineSimulados.length) {
      return res.status(404).json({
        message: "Nenhum simulado encontrado para esta disciplina",
      });
    }

    const simulados = disciplineSimulados.map((simulado) => ({
      id: simulado._id,
      simuladoNumber: simulado.simuladoNumber,
      year: simulado.year,
      startedAt: simulado.startedAt,
      completedAt: simulado.completedAt,
      status: simulado.status,
      score: simulado.score,
      totalQuestions: simulado.questions?.length || 0,
      correctAnswers: simulado.questions?.filter((q) => q.isCorrect)?.length || 0,
    }));

    return res.json(simulados);
  } catch (error) {
    console.error("Get simulados by discipline error:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getSimuladoDetailsById = async (req, res) => {
  try {
    console.time("getSimuladoDetailsById");
    const { discipline, simuladoNumber, language } = req.body;

    // Fetch only necessary fields
    const user = await User.findById(req.user.id).select("simuladoAttempts");

    const validDisciplines = [
      "matematica",
      "linguagens",
      "linguagens-ingles",
      "linguagens-espanhol",
      "ciencias-humanas",
      "ciencias-natureza",
    ];

    let disciplineKey = discipline;
    if (discipline === "linguagens" && language) {
      disciplineKey = `linguagens-${language}`;
    }

    if (!validDisciplines.includes(disciplineKey)) {
      return res.status(400).json({
        message: "Disciplina ou idioma inválido",
      });
    }

    // Validate if discipline exists
    if (!user?.simuladoAttempts?.[disciplineKey]) {
      return res.status(404).json({
        message: "Nenhum simulado encontrado para esta disciplina",
      });
    }

    const simulado = user.simuladoAttempts[disciplineKey].find(
      (s) => s.simuladoNumber === parseInt(simuladoNumber)
    );

    if (!simulado) {
      return res.status(404).json({
        message: "Simulado não encontrado",
      });
    }

    console.timeEnd("getSimuladoDetailsById");

    return res.json({
      id: simulado._id,
      discipline: disciplineKey,
      simuladoNumber: simulado.simuladoNumber,
      year: simulado.year,
      startedAt: simulado.startedAt,
      completedAt: simulado.completedAt,
      status: simulado.status,
      score: simulado.score,
      totalQuestions: simulado.questions?.length || 0,
      correctAnswers: simulado.questions?.filter((q) => q.isCorrect)?.length || 0,
      questions: simulado.questions?.map((q) => ({
        questionId: q.questionId,
        index: q.index,
        title: q.title,
        context: q.context,
        alternatives: q.alternatives,
        userAnswer: q.userAnswer,
        correctAlternative: q.correctAlternative,
        isCorrect: q.isCorrect,
        answeredAt: q.answeredAt,
      })),
    });
  } catch (error) {
    console.error("Get simulado details error:", error);
    res.status(500).json({
      message: "Erro ao buscar detalhes do simulado",
    });
  }
};
