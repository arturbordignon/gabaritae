const axios = require("axios");
const User = require("../models/User");

const QUESTIONS_PER_SIMULADO = 10;

const disciplineOffsets = {
  matematica: 150,
  linguagens: 0,
  "linguagens-ingles": 0,
  "linguagens-espanhol": 0,
  "ciencias-humanas": 46,
  "ciencias-natureza": 100,
};

const regenerateLives = (user) => {
  const now = new Date();
  if (user.vidas < 40 && user.proximaVida && user.proximaVida <= now) {
    const hoursElapsed = Math.floor((now - user.proximaVida) / (3 * 60 * 60 * 1000));
    const livesToAdd = Math.min(hoursElapsed + 1, 40 - user.vidas);

    user.vidas += livesToAdd;
    user.proximaVida = new Date(user.proximaVida.getTime() + livesToAdd * 3 * 60 * 60 * 1000);
  }
};

const fetchQuestions = async (year, discipline, language, res) => {
  try {
    const offset = disciplineOffsets[discipline];
    let rangeStart, rangeEnd;

    // Adjust ranges to be smaller to prevent overwhelming the API
    switch (discipline) {
      case "matematica":
        rangeStart = 150;
        rangeEnd = 165; // Reduced range
        break;
      case "ciencias-humanas":
        rangeStart = 46;
        rangeEnd = 66; // Reduced range
        break;
      case "linguagens":
        rangeStart = 0;
        rangeEnd = 20; // Reduced range
        break;
      default:
        rangeStart = offset;
        rangeEnd = offset + QUESTIONS_PER_SIMULADO;
    }

    const totalQuestions = rangeEnd - rangeStart;
    const apiUrl = `https://api.enem.dev/v1/exams/${year}/questions`;

    // Add logging to help debug API requests
    console.log(`Fetching questions with params:`, {
      year,
      discipline,
      language,
      rangeStart,
      rangeEnd,
      totalQuestions,
    });

    // Make sure we're not requesting too many questions at once
    if (totalQuestions > 20) {
      // Split into multiple requests if needed
      const chunks = [];
      for (let i = rangeStart; i < rangeEnd; i += 20) {
        const chunkEnd = Math.min(i + 20, rangeEnd);
        const response = await axios.get(apiUrl, {
          params: {
            limit: chunkEnd - i,
            offset: i,
            language: discipline.startsWith("linguagens") ? language : undefined,
          },
        });
        if (response.data && response.data.questions) {
          chunks.push(...response.data.questions);
        }
      }
      allQuestions = chunks;
    } else {
      const response = await axios.get(apiUrl, {
        params: {
          limit: totalQuestions,
          offset: rangeStart,
          language: discipline.startsWith("linguagens") ? language : undefined,
        },
      });

      if (!response.data || !response.data.questions) {
        throw new Error("Formato inválido de resposta da API.");
      }

      allQuestions = response.data.questions;
    }

    if (!allQuestions.length) {
      throw new Error("Nenhuma questão encontrada para o intervalo especificado.");
    }

    // Select random questions from the fetched set
    const selectedQuestions = [];
    const availableQuestions = [...allQuestions];

    while (selectedQuestions.length < QUESTIONS_PER_SIMULADO && availableQuestions.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableQuestions.length);
      const question = availableQuestions.splice(randomIndex, 1)[0];
      selectedQuestions.push(question);
    }

    if (selectedQuestions.length < QUESTIONS_PER_SIMULADO) {
      throw new Error(
        `Número insuficiente de questões disponíveis. Encontradas: ${selectedQuestions.length}`
      );
    }

    return selectedQuestions.map((question) => ({
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
          text: alt.text || "Alternativa sem texto fornecido",
          file: alt.file || null,
        }))
        .filter((alt) => alt.letter),
      correctAlternative: question.correctAlternative,
    }));
  } catch (error) {
    console.error("Error in fetchQuestions:", error.message, error.response?.data);
    if (res) {
      res.status(500).json({
        message: error.message,
        details: error.response?.data,
      });
    } else {
      throw error;
    }
  }
};

exports.startSimulado = async (req, res) => {
  try {
    const { year, discipline, language } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

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

    if (user.vidas < 1) {
      if (!user.proximaVida || user.proximaVida <= new Date()) {
        user.proximaVida = new Date();
        user.proximaVida.setHours(user.proximaVida.getHours() + 3);
      }

      regenerateLives(user);
      await user.save();

      return res.status(403).json({
        message: "Sem vidas disponíveis",
        proximaVida: user.proximaVida,
      });
    }

    if (!user.simuladoAttempts[disciplineKey]) {
      user.simuladoAttempts[disciplineKey] = [];
    }

    const activeSimulado = user.currentSimulado?.attemptId
      ? user.simuladoAttempts[disciplineKey].find(
          (attempt) => attempt._id.toString() === user.currentSimulado.attemptId.toString()
        )
      : null;

    if (activeSimulado) {
      const answeredQuestions = activeSimulado.questions.filter((q) => q.userAnswer);

      if (answeredQuestions.length > 0) {
        activeSimulado.completedAt = new Date();
        activeSimulado.status = "completed";
        activeSimulado.score = answeredQuestions.filter((q) => q.isCorrect).length;
      } else {
        user.simuladoAttempts[disciplineKey] = user.simuladoAttempts[disciplineKey].filter(
          (attempt) => attempt._id.toString() !== activeSimulado._id.toString()
        );
      }
      user.currentSimulado = null;
      await user.save();
    }

    const completedCount = user.simuladoAttempts[disciplineKey].filter(
      (s) => s.status === "completed"
    ).length;

    const questions = await fetchQuestions(year, disciplineKey, language, res);
    if (!questions || questions.length < QUESTIONS_PER_SIMULADO) {
      return res.status(500).json({
        message: "Não foi possível obter questões suficientes para o simulado",
      });
    }

    const attempt = {
      discipline: disciplineKey,
      simuladoNumber: completedCount + 1,
      year,
      questions: questions.map((q) => ({
        questionId: q.questionId,
        index: q.index,
        year: q.year,
        title: q.title,
        context: q.context,
        files: q.files,
        alternativesIntroduction: q.alternativesIntroduction,
        alternatives: q.alternatives,
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

    if (!questionId || !userAnswer) {
      return res.status(400).json({
        message: "QuestionId e resposta são obrigatórios",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user.currentSimulado) {
      return res.status(404).json({
        message: "Nenhum simulado ativo",
      });
    }

    const { discipline } = user.currentSimulado;
    let currentAttempt = user.simuladoAttempts[discipline].find(
      (attempt) => attempt._id.toString() === user.currentSimulado.attemptId.toString()
    );

    if (!currentAttempt) {
      return res.status(404).json({
        message: "Simulado não encontrado",
      });
    }

    const questionIndex = currentAttempt.questions.findIndex((q) => q.questionId === questionId);
    if (questionIndex === -1) {
      return res.status(404).json({
        message: "Questão não encontrada",
      });
    }

    const currentQuestion = currentAttempt.questions[questionIndex];

    if (currentQuestion.userAnswer) {
      return res.status(400).json({
        message: "Esta questão já foi respondida",
      });
    }

    const isCorrect = userAnswer === currentQuestion.correctAlternative;
    currentQuestion.userAnswer = userAnswer;
    currentQuestion.isCorrect = isCorrect;
    currentQuestion.answeredAt = new Date();

    if (isCorrect) {
      user.points = (user.points || 0) + 1;
    } else {
      user.points = Math.max((user.points || 0) - 1, 0);
      user.vidas = Math.max(user.vidas - 1, 0);
    }

    const isComplete = currentAttempt.questions.every((q) => q.userAnswer);

    if (isComplete) {
      currentAttempt.completedAt = new Date();
      currentAttempt.status = "completed";
      currentAttempt.score = currentAttempt.questions.filter((q) => q.isCorrect).length;
      user.currentSimulado = null;
    } else {
      user.currentSimulado.questionIndex = questionIndex + 1;
    }

    await user.save();

    return res.json({
      correct: isCorrect,
      vidasRestantes: user.vidas,
      pointsEarned: isCorrect ? 1 : -1,
      currentPoints: user.points,
      level: Math.floor(user.points / 15) + 1,
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
    res.status(500).json({
      message: "Erro ao submeter resposta",
    });
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

    const validDisciplines = [
      "matematica",
      "ciencias-humanas",
      "ciencias-natureza",
      "linguagens",
      "linguagens-ingles",
      "linguagens-espanhol",
    ];

    if (!validDisciplines.includes(discipline)) {
      return res.status(400).json({ message: "Disciplina inválida" });
    }

    const simulado = user.simuladoAttempts[discipline]?.find(
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
    const { discipline, language } = req.body;

    const validDisciplines = [
      "matematica",
      "ciencias-humanas",
      "ciencias-natureza",
      "linguagens",
      "linguagens-ingles",
      "linguagens-espanhol",
    ];

    let disciplineKey = discipline;
    if (discipline === "linguagens" && language) {
      if (!["ingles", "espanhol"].includes(language)) {
        return res.status(400).json({ message: "Idioma inválido para disciplina de linguagens" });
      }
      disciplineKey = `linguagens-${language}`;
    }

    if (!validDisciplines.includes(disciplineKey)) {
      return res.status(400).json({ message: "Disciplina inválida" });
    }

    const user = await User.findById(req.user.id);

    const disciplineSimulados = user.simuladoAttempts[disciplineKey] || [];

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
    console.error("Erro ao pegar simulados para cada disciplina:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getSimuladoDetailsById = async (req, res) => {
  try {
    const { discipline, simuladoNumber, language } = req.body;

    const validDisciplines = [
      "matematica",
      "ciencias-humanas",
      "ciencias-natureza",
      "linguagens",
      "linguagens-ingles",
      "linguagens-espanhol",
    ];

    let disciplineKey = discipline;
    if (discipline === "linguagens" && language) {
      if (!["ingles", "espanhol"].includes(language)) {
        return res.status(400).json({ message: "Idioma inválido para disciplina de linguagens" });
      }
      disciplineKey = `linguagens-${language}`;
    }

    if (!validDisciplines.includes(disciplineKey)) {
      return res.status(400).json({ message: "Disciplina ou idioma inválido" });
    }

    const user = await User.findById(req.user.id);

    const simulado = user.simuladoAttempts[disciplineKey]?.find(
      (s) => s.simuladoNumber === parseInt(simuladoNumber)
    );

    if (!simulado) {
      return res.status(404).json({ message: "Simulado não encontrado" });
    }

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
    res.status(500).json({ message: error.message });
  }
};
