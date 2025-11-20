var express = require("express");
var bodyParser = require("body-parser");
require("dotenv").config();
const config = require("./src/config");
const dbService = require("./src/services/db.service");
const cors = require("cors");
const morgan = require("morgan");
const moment = require("moment-timezone");
const environment = process.env.NODE_ENV;
const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";
moment.tz.setDefault(DEFAULT_TIMEZONE);

var app = express();
app.locals.timezone = DEFAULT_TIMEZONE;

const DB = dbService(environment, config.migrate).start();
// parse application/x-www-form-urlencoded
app.use(cors());
// app.use(express.urlencoded());

morgan.token("date", (req, res, tz) => {
  return moment().tz("Asia/Kolkata").format("YYYY-MM-DD hh:mmA");
});

app.use(morgan(":date :method :url :status"));

app.use(bodyParser.urlencoded({ extended: false }));

// Date formatting helpers (attach to each request)
app.use((req, res, next) => {
  req.formatDate = (date, format = "YYYY-MM-DD") => {
    if (!date) return null;
    return moment(date).tz(DEFAULT_TIMEZONE).format(format);
  };

  req.formatDateTime = (date, format = "YYYY-MM-DD HH:mm:ss") => {
    if (!date) return null;
    return moment(date).tz(DEFAULT_TIMEZONE).format(format);
  };

  req.formatRelativeTime = (date) => {
    if (!date) return null;
    return moment(date).tz(DEFAULT_TIMEZONE).fromNow();
  };

  next();
});

// parse application/json
app.use(bodyParser.json());

app.get("/", function (req, res) {
  res.send("Api working!");
});
require("./src/config/routes").set_routes(app);

// Error handling middleware (must be last)
// 404 handler for routes that don't exist
const { notFound, errorHandler } = require('./src/middleware/errorHandler');
app.use(notFound);
app.use(errorHandler);

//connectDb();
app.listen(config.port, () => {
  if (
    environment !== "production" &&
    environment !== "development" &&
    environment !== "testing"
  ) {
    console.error(
      `NODE_ENV is set to ${environment}, but only production and development are valid.`
    );
    process.exit(1);
  }
  return DB;
});
