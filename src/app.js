const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger/swagger.json");

const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const simuladoRoutes = require("./routes/simuladoRoutes");
const gamificationRoutes = require("./routes/gamificationRoutes");
require("dotenv").config();
const homeRoutes = require("./routes/homeRoutes");

const requestLogger = require("./middlewares/requestLogger");
const errorHandler = require("./middlewares/errorHandler");
const { startLifeRenewalJob } = require("./utils/lifeRenew");

const app = express();
app.use(requestLogger);
connectDB();

app.use(express.json());
app.use(cors());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

startLifeRenewalJob();

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/simulado", simuladoRoutes);
app.use("/api/gamification", gamificationRoutes);

app.use(errorHandler);

module.exports = app;
