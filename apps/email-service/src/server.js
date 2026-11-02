const http = require("http");
const { URL } = require("url");
const config = require("./config");
const { sendInvitation, verifyConnection } = require("./mailer");
const deliveryStore = require("./deliveryStore");

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      // Protect against overly large payloads (max 1MB)
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        console.error("Invalid JSON body received:", body);
        reject(new Error("Invalid JSON body: " + err.message));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, data) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(json);
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  // 1. Healthcheck
  if (req.method === "GET" && pathname === "/health") {
    let smtpCheck = { ok: false, error: null };
    try {
      smtpCheck = await verifyConnection();
    } catch (e) {
      smtpCheck = { ok: false, error: e.message };
    }
    return sendJson(res, smtpCheck.ok ? 200 : 503, {
      status: smtpCheck.ok ? "healthy" : "smtp_unreachable",
      service: "eduproctor-email-service",
      engine: "nodemailer",
      mode: config.mode,
      smtp: {
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        authenticated: Boolean(config.smtp.auth),
        connected: smtpCheck.ok,
        error: smtpCheck.error || null,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Send Invitation
  if (req.method === "POST" && pathname === "/send-invitation") {
    try {
      const body = await parseBody(req);
      const {
        to,
        candidateName,
        assessmentTitle,
        domain,
        durationMin,
        deadline,
        joinUrl,
        instructions,
        assignmentId,
      } = body;

      if (!to) {
        return sendJson(res, 400, { error: "Missing required parameter 'to'" });
      }

      const result = await sendInvitation({
        to,
        candidateName,
        assessmentTitle,
        domain,
        durationMin,
        deadline,
        joinUrl,
        instructions,
        assignmentId,
      });

      return sendJson(res, 200, result);
    } catch (err) {
      console.error("[EmailService Error /send-invitation]:", err);
      return sendJson(res, 500, {
        error: err.message,
        status: "Failed",
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 3. Delivery Status Verification
  if (req.method === "GET" && pathname.startsWith("/delivery-status/")) {
    const messageId = decodeURIComponent(pathname.replace("/delivery-status/", ""));
    const record = deliveryStore.get(messageId);
    if (!record) {
      return sendJson(res, 404, { error: "Message record not found", messageId });
    }
    return sendJson(res, 200, record);
  }

  // 4. Delivery Status by Assignment
  if (req.method === "GET" && pathname.startsWith("/assignment-status/")) {
    const assignmentId = decodeURIComponent(pathname.replace("/assignment-status/", ""));
    const record = deliveryStore.getByAssignment(assignmentId);
    if (!record) {
      return sendJson(res, 404, { error: "No delivery record for assignment", assignmentId });
    }
    return sendJson(res, 200, record);
  }

  // 5. Provider Webhook (e.g. for bounce, delivery receipt)
  if (req.method === "POST" && pathname === "/webhook") {
    try {
      const event = await parseBody(req);
      const { messageId, eventType, reason, timestamp } = event;
      if (messageId && eventType === "bounce") {
        deliveryStore.recordBounced(messageId, reason || "Undeliverable");
      } else if (messageId && (eventType === "delivered" || eventType === "delivery")) {
        deliveryStore.recordDelivered(messageId, { reason, timestamp });
      }
      return sendJson(res, 200, { received: true, eventType });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // 6. Recent Logs
  if (req.method === "GET" && pathname === "/logs") {
    const logs = deliveryStore.listRecent(50);
    return sendJson(res, 200, { count: logs.length, logs });
  }

  return sendJson(res, 404, { error: "Route not found" });
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`[EmailService] Node.js Nodemailer microservice listening on http://0.0.0.0:${config.port}`);
  console.log(`[EmailService] Transport Mode: MAIL_MODE=${config.mailMode} (${config.isLocal ? "Local Mailpit SMTP 1025 / Web 8025" : "External SMTP Relay"})`);
  console.log(`[EmailService] Target SMTP -> ${config.smtp.host}:${config.smtp.port} (secure: ${config.smtp.secure}, ignoreTLS: ${Boolean(config.smtp.ignoreTLS)})`);
});

process.on("SIGTERM", () => {
  server.close(() => console.log("[EmailService] Stopped gracefully"));
});
