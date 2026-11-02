/**
 * In-memory & disk-backed store for tracking email delivery lifecycle:
 * - Queued
 * - Sent
 * - Delivered
 * - Failed
 * - Bounced
 */
const fs = require("fs");
const path = require("path");

const LOG_FILE = path.resolve(__dirname, "../data/delivery_logs.json");

// Ensure data directory exists
const dataDir = path.dirname(LOG_FILE);
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

class DeliveryStore {
  constructor() {
    this.records = new Map();
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(LOG_FILE)) {
        const raw = fs.readFileSync(LOG_FILE, "utf-8");
        const list = JSON.parse(raw);
        for (const item of list) {
          if (item && item.messageId) {
            this.records.set(item.messageId, item);
          }
        }
      }
    } catch (err) {
      console.warn("[DeliveryStore] Could not load persisted logs:", err.message);
    }
  }

  save() {
    try {
      const list = Array.from(this.records.values()).slice(-200);
      fs.writeFileSync(LOG_FILE, JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      console.warn("[DeliveryStore] Could not persist logs:", err.message);
    }
  }

  recordQueued({ messageId, to, candidateName, assessmentTitle, assignmentId }) {
    const item = {
      messageId,
      assignmentId,
      to,
      candidateName,
      assessmentTitle,
      status: "Pending", // Status: Pending when invitation created/queued
      queuedAt: new Date().toISOString(),
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
      bouncedAt: null,
      smtpResponse: null,
      error: null,
    };
    this.records.set(messageId, item);
    this.save();
    return item;
  }

  recordSent(messageId, { smtpResponse, accepted, rejected }) {
    const item = this.records.get(messageId) || { messageId };
    item.status = "Sent"; // Status: Sent when email provider/MTA accepts the message
    item.sentAt = new Date().toISOString();
    item.smtpResponse = smtpResponse;
    item.accepted = accepted;
    item.rejected = rejected;
    // Note: Do NOT mark as Delivered merely on 250 OK. Delivered requires provider delivery event/webhook.

    this.records.set(messageId, item);
    this.save();
    return item;
  }

  recordDelivered(messageId, eventData = {}) {
    const item = this.records.get(messageId) || { messageId };
    item.status = "Delivered"; // Status: Delivered confirmed by provider webhook or delivery receipt
    item.deliveredAt = eventData.timestamp || new Date().toISOString();
    item.deliveryDetails = eventData;
    this.records.set(messageId, item);
    this.save();
    return item;
  }

  recordFailed(messageId, error) {
    const item = this.records.get(messageId) || { messageId };
    item.status = "Failed";
    item.failedAt = new Date().toISOString();
    item.error = error instanceof Error ? error.message : String(error);
    this.records.set(messageId, item);
    this.save();
    return item;
  }

  recordBounced(messageId, reason) {
    const item = this.records.get(messageId) || { messageId };
    item.status = "Bounced";
    item.bouncedAt = new Date().toISOString();
    item.bounceReason = reason;
    this.records.set(messageId, item);
    this.save();
    return item;
  }

  get(messageId) {
    return this.records.get(messageId) || null;
  }

  getByAssignment(assignmentId) {
    for (const rec of this.records.values()) {
      if (rec.assignmentId === assignmentId) return rec;
    }
    return null;
  }

  listRecent(limit = 50) {
    return Array.from(this.records.values()).reverse().slice(0, limit);
  }
}

module.exports = new DeliveryStore();

