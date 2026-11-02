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

// Determine Active Mode: "local" (default) or "smtp" (external)
const rawMode = (process.env.MAIL_MODE || process.env.EMAIL_MODE || "local").trim().toLowerCase();
const isSmtp = rawMode === "smtp" || rawMode === "external";
const mailMode = isSmtp ? "smtp" : "local";

// 1. Local Configuration (Mailpit on http://localhost:8025 / SMTP 1025)
const localConfig = {
  host: process.env.LOCAL_SMTP_HOST || "localhost",
  port: parseInt(process.env.LOCAL_SMTP_PORT || "1025", 10),
  secure: false,
  ignoreTLS: true,
  auth: undefined,
  from: process.env.LOCAL_EMAIL_FROM || "EduProctor Intelligence <no-reply@eduproctor.example.com>",
};

// 2. External Configuration (Real External SMTP Relay)
const smtpHost = process.env.SMTP_HOST && process.env.SMTP_HOST !== "localhost" && process.env.SMTP_HOST !== "127.0.0.1"
  ? process.env.SMTP_HOST
  : process.env.EXTERNAL_SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || process.env.EXTERNAL_SMTP_PORT || "587", 10);
const smtpSecure = process.env.SMTP_SECURE === "true" || process.env.EXTERNAL_SMTP_SECURE === "true" || smtpPort === 465;
const smtpUser = process.env.SMTP_USER || process.env.EXTERNAL_SMTP_USER;
const smtpPass = process.env.SMTP_PASS || process.env.EXTERNAL_SMTP_PASS;
const smtpFrom = process.env.EMAIL_FROM || process.env.EXTERNAL_EMAIL_FROM || (smtpUser ? `EduProctor Intelligence <${smtpUser}>` : null);

const smtpConfig = {
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  ignoreTLS: false,
  auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  from: smtpFrom || "EduProctor Intelligence <no-reply@eduproctor.example.com>",
};

// Active Selection
const active = isSmtp ? smtpConfig : localConfig;

module.exports = {
  port: parseInt(process.env.EMAIL_SERVICE_PORT || "5050", 10),
  mailMode,
  isLocal: !isSmtp,
  isSmtp,
  localConfig,
  smtpConfig,
  smtp: {
    host: active.host === "localhost" ? "127.0.0.1" : (active.host || "127.0.0.1"),
    port: active.port || 1025,
    secure: Boolean(active.secure),
    ignoreTLS: Boolean(active.ignoreTLS),
    auth: active.auth,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  },
  fromAddress: active.from,
};
