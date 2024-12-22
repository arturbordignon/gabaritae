const cron = require("cron");
const https = require("https");
const backendUrl = "https://gabaritae-backend.onrender.com";

const job = new cron.CronJob("*/14 * * * *", function () {
  console.log("Restarting server");

  https
    .get(backendUrl, (res) => {
      if (res.statusCode === 200) {
        console.log("Servidor reiniciado");
      } else {
        console.error(`Falha ao reiniciar servidor. Status code: ${res.statusCode}`);
      }
    })
    .on("error", (err) => {
      console.error("Falha ao reiniciar servidor:", err.message);
    });
});

module.exports = {
  job: job,
};
