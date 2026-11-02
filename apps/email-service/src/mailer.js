const nodemailer = require("nodemailer");
const crypto = require("crypto");
const config = require("./config");
const { generateInvitationEmail } = require("./templates");
const deliveryStore = require("./deliveryStore");

let transporter = null;

function getTransporter() {
  if (!transporter) {
    console.log(`[EmailService] Initializing Nodemailer SMTP transport -> ${config.smtp.host}:${config.smtp.port}`);
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.auth,
      connectionTimeout: config.smtp.connectionTimeout,
      greetingTimeout: config.smtp.greetingTimeout,
      socketTimeout: config.smtp.socketTimeout,
      tls: {
        rejectUnauthorized: false, // Permit local self-signed or dev certificates
      },
    });
  }
  return transporter;
}

/**
 * Verify transporter connectivity
 */
async function verifyConnection() {
  const mailer = getTransporter();
  try {
    const success = await mailer.verify();
    return { ok: true, message: "SMTP server ready" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Sends candidate invitation email via Nodemailer
 */
async function sendInvitation({
  to,
  candidateName,
  assessmentTitle,
  domain,
  durationMin,
  deadline,
  joinUrl,
  instructions,
  assignmentId,
}) {
  if (!to) {
    throw new Error("Recipient email 'to' is required");
  }

  const rawMessageId = `<${Date.now()}.${crypto.randomBytes(8).toString("hex")}@eduproctor.intelligence>`;
  
  // 1. Mark as Queued in delivery verification store
  deliveryStore.recordQueued({
    messageId: rawMessageId,
    to,
    candidateName,
    assessmentTitle,
    assignmentId,
  });

  // 2. Generate multi-part HTML & text templates
  const { plainText, html } = generateInvitationEmail({
    candidateName,
    assessmentTitle,
    domain,
    durationMin,
    deadline,
    joinUrl,
    instructions,
  });

  const cleanSubject = (assessmentTitle || "").startsWith("Your Assessment Invitation:")
    ? assessmentTitle
    : `Your Assessment Invitation: ${assessmentTitle || "EduProctor Assessment"}`;

  const mailOptions = {
    from: config.fromAddress,
    to: to.trim(),
    subject: cleanSubject,
    text: plainText,
    html: html,
    messageId: rawMessageId,
    headers: {
      "X-EduProctor-Assignment-ID": assignmentId || "",
      "X-EduProctor-Candidate": candidateName || "",
      "X-Entity-Ref-ID": rawMessageId,
    },
  };

  const mailer = getTransporter();

  try {
    console.log(`[EmailService] Sending invitation via Nodemailer to: ${to} (Subject: ${mailOptions.subject})`);
    const info = await mailer.sendMail(mailOptions);

    const actualMessageId = info.messageId || rawMessageId;
    const smtpResponse = info.response || "250 Message accepted for delivery";

    // 3. Record Sent / Delivered based on SMTP server acknowledgment
    const record = deliveryStore.recordSent(rawMessageId, {
      smtpResponse,
      accepted: info.accepted,
      rejected: info.rejected,
    });

    console.log(`[EmailService] Delivered successfully -> messageId: ${actualMessageId} | SMTP Response: ${smtpResponse}`);

    return {
      success: true,
      messageId: actualMessageId,
      status: record.status, // "Delivered" or "Sent"
      smtpResponse,
      accepted: info.accepted || [to],
      rejected: info.rejected || [],
      deliveredAt: record.deliveredAt || new Date().toISOString(),
      recipient: to,
    };
  } catch (err) {
    console.error(`[EmailService] Delivery failed to ${to}:`, err.message);
    deliveryStore.recordFailed(rawMessageId, err);
    throw err;
  }
}

module.exports = {
  getTransporter,
  verifyConnection,
  sendInvitation,
};
