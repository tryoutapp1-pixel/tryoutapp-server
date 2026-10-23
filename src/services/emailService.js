const nodemailer = require('nodemailer');
const { env } = require('../config/env');

function transporter() {
  if (!env.smtp.host || !env.smtp.user || !env.smtp.password || !env.smtp.from) {
    throw new Error('SMTP is not configured');
  }
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.password }
  });
}

async function sendVerificationEmail({ email, name, token }) {
  const frontendUrl = env.frontendUrl.replace(/\/+$/, '');
  const url = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return transporter().sendMail({
    from: env.smtp.from, to: email, subject: 'Verify your Tryout App email',
    text: `Hello ${name}, verify your email: ${url}`
  });
}

async function sendPasswordResetEmail({ email, name, token }) {
  const frontendUrl = env.frontendUrl.replace(/\/+$/, '');
  const url = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return transporter().sendMail({
    from: env.smtp.from, to: email, subject: 'Reset your Tryout App password',
    text: `Hello ${name}, reset your password using this link: ${url}`
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
