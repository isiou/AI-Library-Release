const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  db: {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT),
  },
  session: {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
      path: "/",
    },
    name: process.env.SESSION_NAME,
  },
  allowedOrigins: process.env.ALLOWED_ORIGINS,
  ai: {
    ollama: {
      host: process.env.OLLAMA_HOST,
      model: process.env.OLLAMA_MODEL,
      timeout: parseInt(process.env.OLLAMA_TIMEOUT),
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL,
    },
  },
  recommendation: {
    maxLimit: 50,
    defaultLimit: 10,
    fallbackEnabled: true,
  },
};
