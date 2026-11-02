const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// Try loading root .env first, fallback to local .env
const rootEnv = path.resolve(__dirname, "../../../.env");
const localEnv = path.resolve(__dirname, "../.env");

if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv });
} else {
  dotenv.config();
}

module.exports = {
  port: parseInt(process.env.EMAIL_SERVICE_PORT || "5050", 10),
  smtp: {
    host: (process.env.SMTP_HOST === "localhost" ? "127.0.0.1" : process.env.SMTP_HOST) || "127.0.0.1",
    port: parseInt(process.env.SMTP_PORT || "1025", 10),
    secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    // Reasonable timeouts for connection and socket
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  },
  fromAddress:
    process.env.EMAIL_FROM ||
    process.env.EMAIL_FROM_ADDRESS ||
    process.env.MAIL_FROM ||
    "EduProctor Intelligence <no-reply@eduproctor.example.com>",
  testMode: process.env.EMAIL_TEST_MODE === "true",
  testRecipient: process.env.EMAIL_TEST_RECIPIENT || "eduproctor-test@yopmail.com",
};
