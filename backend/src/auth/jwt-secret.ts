import { randomBytes } from 'crypto';

const developmentJwtSecret = randomBytes(48).toString('base64url');

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  return developmentJwtSecret;
}
