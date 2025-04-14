const express = require("express");
const { authRouter, setAuthUser } = require("./routes/authRouter.js");
const orderRouter = require("./routes/orderRouter.js");
const franchiseRouter = require("./routes/franchiseRouter.js");
const version = require("./version.json");
const config = require("./config.js");
const metrics = require("./metrics.js");
const logger = require("./logger.js");

const app = express();
app.use(express.json());

app.use(metrics.track("all"));
app.use(logger.httpLogger);

metrics.sendMetricsPeriodically(120000);

app.use(setAuthUser);
app.use((req, res, next) => {
  if (req.user) {
    metrics.trackUserActivity(req.user.id, req.sessionID || req.user.id);
  }

  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});

const apiRouter = express.Router();
app.use("/api", apiRouter);

apiRouter.use("/auth", metrics.track("/api/auth"), authRouter);
apiRouter.use("/order", metrics.track("/api/order"), orderRouter);
apiRouter.use("/franchise", metrics.track("/api/franchise"), franchiseRouter);

apiRouter.use("/docs", metrics.track("/api/docs"), (req, res) => {
  res.json({
    version: version.version,
    endpoints: [
      ...authRouter.endpoints,
      ...orderRouter.endpoints,
      ...franchiseRouter.endpoints,
    ],
    config: { factory: config.factory.url, db: config.db.connection.host },
  });
});

app.get("/", metrics.track("/"), (req, res) => {
  res.json({
    message: "welcome to JWT Pizza",
    version: version.version,
  });
});

app.use("*", (req, res) => {
  res.status(404).json({
    message: "unknown endpoint",
  });
});

// Default error handler for all exceptions and errors.
app.use((err, req, res, next) => {
  res
    .status(err.statusCode ?? 500)
    .json({ message: err.message, stack: err.stack });
  next();
});

module.exports = app;
