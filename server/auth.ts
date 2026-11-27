import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE_NAME = 'scholaria_session';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'admin';
  student_id_code: string | null;
  department: string;
  semester: string;
  status: 'active' | 'suspended';
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
  authViaCookie?: boolean;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function createSessionToken(userId: number, role: 'student' | 'admin'): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      role,
      exp: Date.now() + TOKEN_TTL_MS,
    })
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string): { sub: number; role: 'student' | 'admin' } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub: number;
      role: 'student' | 'admin';
      exp: number;
    };
    if (!parsed || typeof parsed.sub !== 'number' || typeof parsed.exp !== 'number') {
      return null;
    }
    if (Date.now() > parsed.exp) {
      return null;
    }
    return { sub: parsed.sub, role: parsed.role };
  } catch {
    return null;
  }
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      result[key] = decodeURIComponent(val);
    }
  }
  return result;
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (isHttps) {
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${Math.floor(TOKEN_TTL_MS / 1000)}`
    );
  } else {
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(TOKEN_TTL_MS / 1000)}`
    );
  }
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (isHttps) {
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`
    );
  } else {
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    );
  }
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token: string | null = null;
  let viaCookie = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    const cookies = parseCookieHeader(req.headers.cookie);
    if (cookies[COOKIE_NAME]) {
      token = cookies[COOKIE_NAME];
      viaCookie = true;
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (viaCookie && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const customHeader = req.headers['x-requested-with'];
    if (customHeader !== 'XMLHttpRequest') {
      res.status(403).json({ error: 'Missing required request verification header' });
      return;
    }
  }

  const decoded = verifySessionToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  const user = db
    .prepare(
      'SELECT id, name, email, role, student_id_code, department, semester, status FROM users WHERE id = ?'
    )
    .get(decoded.sub) as AuthUser | undefined;

  if (!user) {
    res.status(401).json({ error: 'Account no longer exists' });
    return;
  }

  if (user.status !== 'active') {
    res.status(403).json({ error: 'Your account has been suspended. Please contact an administrator.' });
    return;
  }

  req.user = user;
  req.authViaCookie = viaCookie;
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Administrator privileges required' });
      return;
    }
    next();
  });
}
