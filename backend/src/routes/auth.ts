import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'academix-super-secure-jwt-secret-key-2026!';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'academix-super-secure-jwt-refresh-secret-key-2026!';

// Login Route
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        admin: true,
        lecturer: {
          include: { department: true }
        },
        student: {
          include: { department: true, program: true }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordValid = bcrypt.compareSync(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Save refresh token in DB
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken }
    });

    // Profile details based on role
    let profile = null;
    if (user.role === 'ADMIN') profile = user.admin;
    else if (user.role === 'LECTURER') profile = user.lecturer;
    else if (user.role === 'STUDENT') profile = user.student;

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// Refresh Token Route
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required.' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: 'Invalid or expired refresh token.' });
    }

    // Issue new access token
    const newAccessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.json({ accessToken: newAccessToken });
  } catch (error) {
    return res.status(403).json({ message: 'Invalid refresh token.' });
  }
});

// Get Current User Profile Route
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: authReq.user.id },
      include: {
        admin: true,
        lecturer: {
          include: { department: true }
        },
        student: {
          include: { department: true, program: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    let profile = null;
    if (user.role === 'ADMIN') profile = user.admin;
    else if (user.role === 'LECTURER') profile = user.lecturer;
    else if (user.role === 'STUDENT') profile = user.student;

    return res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      profile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// Logout Route
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(400).json({ message: 'Bad request.' });
  }

  try {
    await prisma.user.update({
      where: { id: authReq.user.id },
      data: { refreshToken: null }
    });
    return res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
