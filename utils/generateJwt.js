import jwt from 'jsonwebtoken';

export function generateJwt(userId, role) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');
  return jwt.sign({ userId, role }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '6h',
  });
}

export function verifyJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');
  return jwt.verify(token, secret);
}
