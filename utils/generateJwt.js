import jwt from 'jsonwebtoken';

export function generateJwt(userId, role) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');
  const expiresIn = (role === 'ADMIN' || role === 'MASTER_ADMIN') ? '15h' : (process.env.JWT_EXPIRES_IN || '15h');
  return jwt.sign({ userId, role }, secret, {
    expiresIn,
  });
}

export function generateRefreshToken(userId, role) {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');
  return jwt.sign({ userId, role, type: 'refresh' }, secret, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

export function generateTokens(userId, role) {
  const accessToken = generateJwt(userId, role);
  const refreshToken = generateRefreshToken(userId, role);
  return {
    token: accessToken,
    accessToken,
    refreshToken,
  };
}

export function verifyJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');
  return jwt.verify(token, secret);
}

export function verifyRefreshToken(token) {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');
  return jwt.verify(token, secret);
}
