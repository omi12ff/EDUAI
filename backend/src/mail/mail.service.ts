import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendEmailVerification(to: string, verificationLink: string) {
    return this.send({
      to,
      subject: 'Verifica tu cuenta de EduAI',
      text: [
        'Hola,',
        '',
        'Para activar tu cuenta de EduAI, abre este enlace:',
        verificationLink,
        '',
        'El enlace vence en 24 horas.',
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
          <h2 style="margin:0 0 12px">Verifica tu cuenta de EduAI</h2>
          <p>Para activar tu cuenta, presiona el boton:</p>
          <p>
            <a href="${verificationLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">
              Verificar correo
            </a>
          </p>
          <p style="font-size:13px;color:#475569">El enlace vence en 24 horas.</p>
        </div>
      `,
    });
  }

  private async send(payload: MailPayload) {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      this.logMissingTransport(payload);
      return false;
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM ?? user,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    return true;
  }

  private logMissingTransport(payload: MailPayload) {
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn(
        `SMTP no configurado. No se pudo enviar correo a ${payload.to}.`,
      );
      return;
    }

    this.logger.warn(
      `SMTP no configurado. Correo de prueba para ${payload.to}:\n${payload.text}`,
    );
  }
}
