const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// Try loading root .env first, fallback to local .env
const rootEnv = path.resolve(__dirname, "../../../.env");
const localEnv = path.resolve(__dirname, "../.env");

if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}
if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv, override: true });
}

// Determine Active Mode: "local" (default) or "external"
const requestedMode = (process.env.EMAIL_MODE || (process.env.EXTERNAL_SMTP_HOST ? "external" : "local")).trim().toLowerCase();
const isExternal = requestedMode === "external";

// 1. Local Configuration (Dev Mailbox on http://localhost:8025 / SMTP 1025)
const localConfig = {
  host: process.env.LOCAL_SMTP_HOST || (process.env.SMTP_HOST === "localhost" ? "127.0.0.1" : (process.env.SMTP_HOST || "127.0.0.1")),
  port: parseInt(process.env.LOCAL_SMTP_PORT || (!isExternal ? process.env.SMTP_PORT : null) || "1025", 10),
  secure: false,
  auth: undefined,
  from: process.env.LOCAL_EMAIL_FROM || "EduProctor Intelligence <no-reply@eduproctor.example.com>",
};

// 2. External Configuration (Real Internet Delivery to YOPmail / Gmail)
const externalHost = process.env.EXTERNAL_SMTP_HOST || (isExternal ? process.env.SMTP_HOST : null);
const externalPort = parseInt(process.env.EXTERNAL_SMTP_PORT || (isExternal ? process.env.SMTP_PORT : null) || "587", 10);
const externalSecure = process.env.EXTERNAL_SMTP_SECURE === "true" || externalPort === 465;
const externalUser = process.env.EXTERNAL_SMTP_USER || (isExternal ? process.env.SMTP_USER : null);
const externalPass = process.env.EXTERNAL_SMTP_PASS || (isExternal ? process.env.SMTP_PASS : null);
const externalFrom = process.env.EXTERNAL_EMAIL_FROM || process.env.EMAIL_FROM || (externalUser ? `EduProctor Intelligence <${externalUser}>` : null);

const externalConfig = {
  host: externalHost,
  port: externalPort,
  secure: externalSecure,
  auth: externalUser && externalPass ? { user: externalUser, pass: externalPass } : undefined,
  from: externalFrom || "EduProctor Intelligence <no-reply@eduproctor.example.com>",
};

// Active Selection
const active = isExternal ? externalConfig : localConfig;

module.exports = {
  port: parseInt(process.env.EMAIL_SERVICE_PORT || "5050", 10),
  mode: isExternal ? "external" : "local",
  isExternal,
  localConfig,
  externalConfig,
  smtp: {
    host: active.host || "127.0.0.1",
    port: active.port || 1025,
    secure: Boolean(active.secure),
    auth: active.auth,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  },
  fromAddress: active.from,
  testMode: process.env.EMAIL_TEST_MODE === "true",
  testRecipient: process.env.EMAIL_TEST_RECIPIENT || "eduproctor-test@yopmail.com",
};
