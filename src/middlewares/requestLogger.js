const logger = require("../config/logger");

const requestLogger = (req, res, next) => {
  logger.info(`Requisição recebida: ${req.method} ${req.url}`);
  res.on("finish", () => {
    logger.info(`Resposta enviada: ${req.method} ${req.url} - Status: ${res.statusCode}`);
  });
  next();
};

module.exports = requestLogger;
