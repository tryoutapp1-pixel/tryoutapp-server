const nodemailer = require('nodemailer');
const { env } = require('../config/env');

/** @typedef {{ email: string, name: string, token: string }} EmailLinkInput */

/** Builds a transport per send so missing SMTP config fails the request, not startup. */
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

/**
 * @param {string} path - Frontend route, e.g. '/verify-email'
 * @param {string} token
 */
function frontendLink(path, token) {
  return `${env.frontendUrl.replace(/\/+$/, '')}${path}?token=${encodeURIComponent(token)}`;
}

/** @param {EmailLinkInput} input */
async function sendVerificationEmail({ email, name, token }) {
  const url = frontendLink('/verify-email', token);
  return transporter().sendMail({
    from: env.smtp.from,
    to: email,
    subject: 'Verify your Tryout App email',
    text: `Hello ${name}, verify your email: ${url}`
  });
}

/** @param {EmailLinkInput} input */
async function sendPasswordResetEmail({ email, name, token }) {
  const url = frontendLink('/reset-password', token);
  return transporter().sendMail({
    from: env.smtp.from,
    to: email,
    subject: 'Reset your Tryout App password',
    text: `Hello ${name}, reset your password using this link: ${url}`
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
