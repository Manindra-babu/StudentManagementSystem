import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'academix-super-secure-jwt-secret-key-2026!';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'ADMIN' | 'LECTURER' | 'STUDENT';
    profile?: any;
  };
}

import prisma from '../db';

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication token missing.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        admin: { include: { department: true } },
        lecturer: { include: { department: true } },
        student: { include: { department: true, section: true, program: true } }
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    let profile = null;
    if (user.role === 'ADMIN') profile = user.admin;
    else if (user.role === 'LECTURER') profile = user.lecturer;
    else if (user.role === 'STUDENT') profile = user.student;

    (req as AuthRequest).user = {
      id: user.id,
      email: user.email,
      role: user.role as any,
      profile
    };

    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
}

export function requireRole(roles: ('ADMIN' | 'LECTURER' | 'STUDENT')[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthRequest).user;
    if (!user) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }
    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: 'Access denied: Insufficient permissions.' });
    }
    next();
  };
}
