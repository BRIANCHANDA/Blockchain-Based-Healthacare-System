import { Context, Next } from 'hono';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'healthcare_jwt_secret';

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    console.log('Missing or malformed Authorization header');
    return c.json({ success: false, error: { message: 'Unauthorized' } }, 401);
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = verify(token, JWT_SECRET) as any;

    console.log('JWT verified, userId:', payload.userId, 'exp:', payload.exp, 'current time:', Math.floor(Date.now() / 1000));

    c.set('userId', payload.userId);
    c.set('userType', payload.userType);
    c.set('blockchainAddress', payload.blockchainAddress);

    await next();
  } catch (err) {
    console.log('JWT verification failed:', err.message);
    return c.json({ success: false, error: { message: 'Invalid token' } }, 401);
  }
}

export function requireUserType(...types: string[]) {
  return async (c: Context, next: Next) => {
    const userType = c.get('userType');
    if (!types.includes(userType)) {
      return c.json({
        success: false,
        error: { message: `Access denied. Required: ${types.join(', ')}` }
      }, 403);
    }
    await next();
  };
}
