const app = require("./app");
const logger = require("./config/logger");
const mongoose = require("mongoose");
const { job } = require("./cron");
job.start();

const PORT = process.env.PORT || 4500;

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    logger.info("Conexão com MongoDB bem-sucedida.");
    app.listen(PORT, () => logger.info(`Servidor rodando na porta ${PORT}`));
  })
  .catch((err) => {
    logger.error(`Erro ao conectar ao MongoDB: ${err.message}`);
    process.exit(1);
  });
