const express = require("express");
const cors = require("cors");
const session = require("express-session");
const config = require("./config");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const sanitizeRequest = require("./middleware/sanitizeRequest");
const swaggerUi = require("swagger-ui-express");
const openapiSpec = require("./openapi.json");
const aiAssistantRoutes = require("./routes/ai-assistant");
const aiAdminRoutes = require("./routes/ai-admin");
const authRoutes = require("./routes/auth");
const borrowsRoutes = require("./routes/borrows");
const accountRoutes = require("./routes/account");
const recommendationsRoutes = require("./routes/recommendations");
const adminRoutes = require("./routes/admin");
const booksRoutes = require("./routes/books");
const announcementsRoutes = require("./routes/announcements");

const app = express();

app.set("trust proxy", 1);

const allowedOrigins = [
  "http://isiou.top",
  "http://www.isiou.top",
  "https://isiou.top",
  "https://www.isiou.top",
  "http://localhost:5173",
];

// const allowedOrigins = config.allowedOrigins
//   .split(",")
//   .map((origin) => origin.trim());

app.use(
  cors({
    origin: function (origin, callback) {
      // 允许没有 origin 的请求
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(session(config.session));
app.use(helmet());
app.use(sanitizeRequest);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

// Swagger UI
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
    },
  }),
);

// OpenAPI JSON
app.get("/docs/openapi.json", (req, res) => {
  res.json(openapiSpec);
});

// Routes
app.get("/", (req, res) => {
  res.send({ "Health Check": "Backend is running." });
});
app.use("/api/ai-assistant", aiAssistantRoutes);
app.use("/api/ai-admin", aiAdminRoutes);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/borrows", borrowsRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/recommendations", recommendationsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/books", booksRoutes);
app.use("/api/announcements", announcementsRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Server Error.");
});

module.exports = app;
