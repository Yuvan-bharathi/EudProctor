/**
 * Generates responsive HTML and Plain-Text candidate invitation emails
 */
function generateInvitationEmail({
  candidateName,
  assessmentTitle,
  domain,
  durationMin,
  deadline,
  joinUrl,
  instructions,
}) {
  const safeName = candidateName || "Candidate";
  const safeTitle = assessmentTitle || "Technical Assessment";
  const safeDomain = domain || "General Competency";
  const safeDuration = durationMin ? `${durationMin} minutes` : "60 minutes";
  const safeDeadline = deadline || "Until Assessment Window Closes";
  const safeUrl = joinUrl || "http://localhost:5173/candidate";

  const plainText = `
Hello ${safeName},

You have been invited to complete the proctored assessment "${safeTitle}".

Assessment Details:
- Track / Domain: ${safeDomain}
- Duration: ${safeDuration}
- Completion Deadline: ${safeDeadline}

Pre-Examination Instructions:
1. Ensure you are in a quiet, well-lit room with a stable internet connection.
2. A working webcam and microphone are mandatory for biometric face verification and identity compliance.
3. You will complete biometric consent, 3 reference photo captures, a dynamic liveness check (blink/turn), and environmental calibration before the timer begins.
4. Fullscreen mode will be enforced; switching tabs or opening unauthorized applications will be flagged.

To begin your pre-checks and launch the assessment, click the link below:
${safeUrl}

Note: This is a secure, single-use examination link issued specifically for ${safeName}.

Best regards,
EduProctor Intelligence Academic Team
`.trim();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Assessment Invitation: ${escapeHtml(safeTitle)}</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); padding: 32px 36px; color: #ffffff;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.1em; background: rgba(255, 255, 255, 0.2); padding: 4px 10px; border-radius: 9999px;">AI-Monitored Assessment</span>
        <span style="font-size: 12px; opacity: 0.9;">Single-Use Token</span>
      </div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">EduProctor Intelligence</h1>
      <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">Official Candidate Invitation & Proctoring Directives</p>
    </div>

    <!-- Body Content -->
    <div style="padding: 36px;">
      <p style="font-size: 16px; margin-top: 0; color: #0f172a;">
        Dear <strong>${escapeHtml(safeName)}</strong>,
      </p>
      <p style="font-size: 14px; color: #475569; margin-bottom: 24px;">
        You have been officially scheduled to complete the proctored assessment <strong style="color: #0f766e;">"${escapeHtml(safeTitle)}"</strong>. Please review the details and instructions below before beginning.
      </p>

      <!-- Key Details Card -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 38%;">Domain / Track:</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${escapeHtml(safeDomain)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; border-top: 1px solid #f1f5f9;">Exam Duration:</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a; border-top: 1px solid #f1f5f9;">${escapeHtml(safeDuration)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; border-top: 1px solid #f1f5f9;">Valid Until:</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f766e; border-top: 1px solid #f1f5f9;">${escapeHtml(safeDeadline)}</td>
          </tr>
        </table>
      </div>

      <!-- Instructions Section -->
      <div style="border-left: 4px solid #0f766e; background: #f0fdfa; padding: 16px 20px; border-radius: 6px; margin-bottom: 32px;">
        <h3 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #115e59; text-transform: uppercase; letter-spacing: 0.05em;">Mandatory Pre-Checks:</h3>
        <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #134e4a; line-height: 1.6;">
          <li>A working <strong>webcam and microphone</strong> are required throughout.</li>
          <li>You will complete <strong>biometric face verification</strong> and a dynamic liveness check before the timer starts.</li>
          <li>Ensure your face is clearly visible under good lighting; avoid glare or hats.</li>
          <li>Only single-face presence is permitted; multiple faces or frequent glance deviations will trigger automated proctoring flags.</li>
        </ul>
      </div>

      <!-- Action Button CTA -->
      <div style="text-align: center; margin: 36px 0;">
        <a href="${safeUrl}" target="_blank" style="background-color: #0f766e; color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 10px; font-size: 15px; font-weight: 700; display: inline-block; box-shadow: 0 4px 6px -1px rgba(15, 118, 110, 0.3); transition: background-color 0.15s ease;">
          Start Assessment &rarr;
        </a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">
        Button not working? Copy and paste this single-use link into your browser:<br>
        <a href="${safeUrl}" style="color: #0f766e; word-break: break-all; font-family: monospace; font-size: 11px;">${safeUrl}</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 36px; text-align: center; font-size: 11px; color: #94a3b8;">
      <p style="margin: 0 0 4px 0;">Issued by EduProctor Intelligence System &bull; Single-use cryptographic token bound to ${escapeHtml(safeName)}.</p>
      <p style="margin: 0;">If you received this in error, please disregard.</p>
    </div>
  </div>
</body>
</html>`;

  return { plainText, html };
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = {
  generateInvitationEmail,
};

