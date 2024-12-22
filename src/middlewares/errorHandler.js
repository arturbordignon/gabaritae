const logger = require("../config/logger");

const errorHandler = (err, req, res, next) => {
  logger.error(`Erro no servidor: ${err.message}`);
  res.status(err.status || 500).json({ message: "Erro no servidor" });
};

module.exports = errorHandler;
