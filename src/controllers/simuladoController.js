const axios = require("axios");

exports.listTopics = async (req, res) => {
  try {
    const response = await axios.get("https://api.enem.dev/v1/exams");
    res.status(200).json({ topics: response.data });
  } catch (error) {
    res.status(500).json({ message: "Erro ao listar tópicos.", error: error.message });
  }
};

exports.getQuestionsByYearAndDiscipline = async (req, res) => {
  try {
    const { year, discipline } = req.body;

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

    res.status(200).json({ questions: response.data });
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar questões.", error: error.message });
  }
};
