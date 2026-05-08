let nodemailer = null;

try {
  nodemailer = require('nodemailer');
} catch (_error) {
  nodemailer = null;
}

const getTransporter = () => {
  if (!nodemailer) return null;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

const sendEmail = async ({ to, subject, text, html }) => {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@shopvault.local';
  const transporter = getTransporter();

  if (!transporter) {
    console.log('Email delivery fallback: SMTP is not configured.');
    console.log(JSON.stringify({ to, subject, text, html }, null, 2));
    return { delivered: false, fallback: true };
  }

  await transporter.sendMail({ from, to, subject, text, html });
  return { delivered: true, fallback: false };
};

module.exports = { sendEmail };
