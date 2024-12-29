const axios = require("axios");
const User = require("../models/User");
const moment = require("moment");

const QUESTIONS_PER_SIMULADO = 10;
const MAX_SIMULADOS_PER_DISCIPLINE = 10;
const MAX_ANSWER_TIME_SECONDS = 300;

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

    // Debug log to verify API response
    console.log(
      "API Response Questions:",
      response.data.questions.map((q) => ({
        questionId: q.index,
        correctAlternative: q.correctAlternative,
      }))
    );

    return response.data.questions.map((question, index) => ({
      questionId: question.index.toString(),
      index: question.index,
      year: question.year,
      title: question.title,
      context: question.context,
      files: question.files || [],
      alternatives: question.alternatives.map((alt) => ({
        letter: alt.letter,
        text: alt.text,
        file: alt.file || null,
      })),
      correctAlternative: question.correctAlternative, // Ensure this is fetched
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
      return res.status(403).json({
        error: "Sem vidas disponíveis",
        proximaVida: user.proximaVida,
      });
    }

    const completedCount = user.simuladoAttempts.filter(
      (s) => s.discipline === discipline && s.status === "completed"
    ).length;

    if (completedCount >= MAX_SIMULADOS_PER_DISCIPLINE) {
      return res.status(400).json({ error: "Limite de simulados atingido" });
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
        title: q.title || `Questão ${q.index} - ENEM ${q.year}`, // Ensure title exists
        context: q.context || "", // Ensure context exists
        files: q.files || [],
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

    user.simuladoAttempts.push(attempt);
    await user.save();

    const attemptId = user.simuladoAttempts[user.simuladoAttempts.length - 1]._id;

    user.currentSimulado = {
      attemptId,
      questionIndex: 0,
      startedAt: new Date(),
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
    res.status(500).json({ error: error.message });
  }
};

exports.submitAnswer = async (req, res) => {
  try {
    const { userAnswer, responseTime } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.currentSimulado) {
      return res.status(404).json({ error: "Nenhum simulado ativo" });
    }

    // Debug log
    console.log("Current simulado:", {
      currentSimulado: user.currentSimulado,
      attemptsCount: user.simuladoAttempts.length,
    });

    // Get current attempt
    let currentAttempt = user.simuladoAttempts[user.simuladoAttempts.length - 1];

    if (!currentAttempt) {
      return res.status(404).json({ error: "Simulado não encontrado" });
    }

    // Get current question
    const currentQuestion = currentAttempt.questions[user.currentSimulado.questionIndex];

    if (!currentQuestion) {
      return res.status(404).json({ error: "Questão não encontrada" });
    }

    const isCorrect = userAnswer === currentQuestion.correctAlternative;

    currentQuestion.userAnswer = userAnswer;
    currentQuestion.isCorrect = isCorrect;
    currentQuestion.responseTime = responseTime * 1000;
    currentQuestion.answeredAt = new Date();

    if (!isCorrect) {
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
          error: "Você perdeu todas as vidas! Tente novamente mais tarde.",
          vidasRestantes: 0,
          proximaVida: proximaVida,
        });
      }
    }

    const isComplete = user.currentSimulado.questionIndex === QUESTIONS_PER_SIMULADO - 1;

    if (isComplete) {
      currentAttempt.completedAt = new Date();
      currentAttempt.status = "completed";
      currentAttempt.score = currentAttempt.questions.filter((q) => q.isCorrect).length;
      user.currentSimulado = null;
    } else {
      user.currentSimulado.questionIndex += 1;
    }

    await user.save();

    return res.json({
      correct: isCorrect,
      vidasRestantes: user.vidas,
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
};

exports.getSimuladoDetails = async (req, res) => {
  try {
    const { discipline, simuladoNumber } = req.params;
    const user = await User.findById(req.user.id);

    const simulado = user.simuladoAttempts.find(
      (s) => s.discipline === discipline && s.simuladoNumber === parseInt(simuladoNumber)
    );

    if (!simulado) {
      return res.status(404).json({ error: "Simulado não encontrado" });
    }

    return res.json(simulado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const processAnswer = async (user, questionId, userAnswer, responseTime) => {
  try {
    const currentQuestion = user.currentSimulado.questions[user.currentSimulado.questionIndex];
    const question = await fetchQuestion(currentQuestion.year, currentQuestion.index);

    const isCorrect =
      question.alternatives.find((alt) => alt.letter === userAnswer)?.isCorrect || false;

    currentQuestion.userAnswer = userAnswer;
    currentQuestion.responseTime = responseTime;
    currentQuestion.isCorrect = isCorrect;
    currentQuestion.answeredAt = new Date();

    if (!isCorrect) {
      user.vidas--;
      user.points = Math.max(0, user.points - 1);

      if (user.vidas === 0) {
        user.currentSimulado.status = "failed";
        user.proximaVida = moment().add(3, "hours").toDate();

        return {
          status: "failed",
          correct: false,
          vidasRestantes: 0,
          proximaVida: user.proximaVida,
          message: "Simulado finalizado - Sem vidas restantes",
        };
      }
    } else {
      user.points++;
    }

    user.currentSimulado.questionIndex++;
    const isComplete = user.currentSimulado.questionIndex >= QUESTIONS_PER_SIMULADO;

    if (isComplete) {
      user.currentSimulado.status = "completed";
      user.currentSimulado.completedAt = new Date();

      const completedSimulado = {
        ...user.currentSimulado,
        score: user.currentSimulado.questions.filter((q) => q.isCorrect).length,
      };

      user.simuladoAttempts.push(completedSimulado);
      user.currentSimulado = null;
    }

    return {
      status: isComplete ? "completed" : "in_progress",
      correct: isCorrect,
      vidasRestantes: user.vidas,
      points: user.points,
      nextQuestion: isComplete
        ? null
        : user.currentSimulado?.questions[user.currentSimulado.questionIndex],
    };
  } catch (error) {
    throw new Error(`Error processing answer: ${error.message}`);
  }
};

const fetchQuestion = async (year, index) => {
  try {
    const response = await axios.get(`https://api.enem.dev/v1/exams/${year}/questions/${index}`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch question: ${error.message}`);
  }
};
