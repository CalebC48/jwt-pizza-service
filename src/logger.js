const config = require("./config.js");
const Logger = require("pizza-logger");

const pizzaLoggerConfig = {
  ...config,
  sanitize: true,
  sensitiveFields: ["password"],
};

const logger = new Logger(pizzaLoggerConfig);
module.exports = logger;
