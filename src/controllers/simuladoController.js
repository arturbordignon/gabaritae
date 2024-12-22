const axios = require("axios");

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

    res.status(200).json({ questions: response.data.questions });
  } catch (error) {
    console.error("Erro ao buscar questões:", error.message);
    res.status(500).json({ message: "Erro ao buscar questões.", error: error.message });
  }
};
