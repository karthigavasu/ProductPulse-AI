import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser, UserRole } from '../src/types/productpulse.js';

const EPHEMERAL_SIGNING_SECRET = crypto.randomBytes(32).toString('hex');

function getSigningSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  return configured && configured.length >= 16
    ? configured
    : EPHEMERAL_SIGNING_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  if (!salt || !originalHex) return false;
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  const originalBuf = Buffer.from(originalHex, 'hex');
  if (derivedBuf.length !== originalBuf.length) return false;
  return crypto.timingSafeEqual(derivedBuf, originalBuf);
}

export function verifyEnvAdminPasscode(candidate: string): boolean {
  const envPasscode = process.env.ADMIN_PASSCODE?.trim();
  if (!envPasscode) return false;
  const hashA = crypto.createHash('sha256').update(candidate).digest();
  const hashB = crypto.createHash('sha256').update(envPasscode).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export interface TokenPayload {
  sub: number;
  email: string;
  name: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export function signAuthToken(user: AuthUser): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    iat: nowSec,
    exp: nowSec + 60 * 60 * 24, // 24 hours
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  );
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${sig}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, sig] = parts;
  if (!encodedPayload || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as TokenPayload;
    if (!parsed || typeof parsed.sub !== 'number' || !parsed.exp) return null;
    if (Math.floor(Date.now() / 1000) > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  authUser?: TokenPayload;
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req);
  if (token) {
    const verified = verifyAuthToken(token);
    if (verified) {
      req.authUser = verified;
    }
  }
  next();
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({
      error: 'Authentication required. Please sign in to modify workspace records.',
    });
    return;
  }
  const verified = verifyAuthToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
    return;
  }
  req.authUser = verified;
  next();
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.authUser.role !== 'admin') {
    res.status(403).json({
      error: 'Admin role required for this action.',
    });
    return;
  }
  next();
}
