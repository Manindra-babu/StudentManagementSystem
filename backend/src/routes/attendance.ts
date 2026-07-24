import { Router, Response } from 'express';
import prisma from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// 1. Create Attendance Session (Lecturer Only)
router.post('/session', authenticateToken, requireRole(['LECTURER']), async (req: AuthRequest, res: Response) => {
  const { courseOfferingId, minutesValid = 10 } = req.body;

  if (!courseOfferingId) {
    return res.status(400).json({ message: 'Course offering ID is required.' });
  }

  try {
    const offering = await prisma.courseOffering.findFirst({
      where: {
        id: courseOfferingId,
        lecturerId: req.user!.profile?.id
      }
    });

    if (!offering && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ message: 'You are not assigned to this course offering.' });
    }

    // Deactivate previous active sessions for this course offering
    await prisma.attendanceSession.updateMany({
      where: { courseOfferingId, status: 'ACTIVE' },
      data: { status: 'EXPIRED' }
    });

    const code = Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString().slice(-4);
    const expiresAt = new Date(Date.now() + minutesValid * 60000);

    const session = await prisma.attendanceSession.create({
      data: {
        courseOfferingId,
        date: new Date(),
        code,
        expiresAt,
        status: 'ACTIVE'
      }
    });

    return res.status(201).json(session);
  } catch (error) {
    console.error('Create session error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 2. Student QR Check-in (Student Only)
router.post('/checkin', authenticateToken, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  const { code } = req.body;
  const student = req.user!.profile;

  if (!code) {
    return res.status(400).json({ message: 'Verification code is required.' });
  }

  try {
    const session = await prisma.attendanceSession.findFirst({
      where: { code, status: 'ACTIVE' },
      include: { courseOffering: true }
    });

    if (!session) {
      return res.status(404).json({ message: 'No active attendance session found for this code.' });
    }

    if (new Date() > session.expiresAt) {
      await prisma.attendanceSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' }
      });
      return res.status(410).json({ message: 'This attendance session has expired.' });
    }

    // Verify student is enrolled in this course offering
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_courseOfferingId: {
          studentId: student.id,
          courseOfferingId: session.courseOfferingId
        }
      }
    });

    if (!enrollment || enrollment.status !== 'REGISTERED') {
      return res.status(403).json({ message: 'You are not registered in this class.' });
    }

    // Create or update attendance record
    const record = await prisma.attendanceRecord.upsert({
      where: {
        sessionId_studentId: {
          sessionId: session.id,
          studentId: student.id
        }
      },
      update: {
        status: 'PRESENT',
        markedMethod: 'QR',
        markedAt: new Date()
      },
      create: {
        sessionId: session.id,
        studentId: student.id,
        status: 'PRESENT',
        markedMethod: 'QR',
        markedAt: new Date()
      }
    });

    // Real-time notification to Lecturer via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`session_${session.id}`).emit('studentCheckedIn', {
        studentId: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        status: 'PRESENT',
        markedMethod: 'QR',
        markedAt: record.markedAt
      });
    }

    return res.json({ message: 'Attendance marked successfully.', record });
  } catch (error) {
    console.error('Check-in error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 3. Get Session Roster & Stats (Lecturer / Admin)
router.get('/session/:sessionId/roster', authenticateToken, requireRole(['LECTURER', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  const { sessionId } = req.params;

  try {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        courseOffering: {
          include: {
            course: true,
            section: { include: { department: true } },
            enrollments: {
              where: { status: 'REGISTERED' },
              include: {
                student: true
              }
            }
          }
        },
        records: true
      }
    });

    if (!session) {
      return res.status(404).json({ message: 'Attendance session not found.' });
    }

    const roster = session.courseOffering.enrollments.map(env => {
      const record = session.records.find(r => r.studentId === env.studentId);
      return {
        studentId: env.student.id,
        name: env.student.name,
        rollNumber: env.student.rollNumber,
        status: record ? record.status : 'ABSENT',
        markedMethod: record ? record.markedMethod : null,
        markedAt: record ? record.markedAt : null,
        updatedById: record ? record.updatedById : null,
        updateReason: record ? record.updateReason : null
      };
    });

    return res.json({
      session: {
        id: session.id,
        code: session.code,
        date: session.date,
        expiresAt: session.expiresAt,
        status: session.status,
        courseName: session.courseOffering.course.name,
        courseCode: session.courseOffering.course.code,
        sectionName: session.courseOffering.section.name,
        departmentName: session.courseOffering.section.department.name
      },
      roster
    });
  } catch (error) {
    console.error('Fetch roster error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 4. Manual Attendance Override (Lecturer / Admin)
router.post('/session/:sessionId/override', authenticateToken, requireRole(['LECTURER', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  const { sessionId } = req.params;
  const { studentId, status, reason = 'Lecturer manual change' } = req.body;

  if (!studentId || !status) {
    return res.status(400).json({ message: 'Student ID and status are required.' });
  }

  try {
    const record = await prisma.attendanceRecord.upsert({
      where: {
        sessionId_studentId: {
          sessionId,
          studentId
        }
      },
      update: {
        status,
        markedMethod: 'MANUAL',
        updatedById: req.user!.id,
        updateReason: reason,
        markedAt: new Date()
      },
      create: {
        sessionId,
        studentId,
        status,
        markedMethod: 'MANUAL',
        updatedById: req.user!.id,
        updateReason: reason,
        markedAt: new Date()
      },
      include: {
        student: true
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`session_${sessionId}`).emit('rosterUpdated', {
        studentId,
        name: record.student.name,
        rollNumber: record.student.rollNumber,
        status,
        markedMethod: 'MANUAL',
        markedAt: record.markedAt,
        updatedById: req.user!.id,
        updateReason: reason
      });
    }

    return res.json({ message: 'Attendance status overridden.', record });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 5. Bulk Attendance Action (e.g. Mark All Present)
router.post('/session/:sessionId/mark-all', authenticateToken, requireRole(['LECTURER', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  const { sessionId } = req.params;
  const { status = 'PRESENT', reason = 'Lecturer bulk action' } = req.body;

  try {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        courseOffering: {
          include: {
            enrollments: { where: { status: 'REGISTERED' } }
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ message: 'Attendance session not found.' });
    }

    const enrolledStudentIds = session.courseOffering.enrollments.map(e => e.studentId);

    for (const studentId of enrolledStudentIds) {
      await prisma.attendanceRecord.upsert({
        where: {
          sessionId_studentId: {
            sessionId,
            studentId
          }
        },
        update: {
          status,
          markedMethod: 'MANUAL',
          updatedById: req.user!.id,
          updateReason: reason,
          markedAt: new Date()
        },
        create: {
          sessionId,
          studentId,
          status,
          markedMethod: 'MANUAL',
          updatedById: req.user!.id,
          updateReason: reason,
          markedAt: new Date()
        }
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`session_${sessionId}`).emit('rosterBulkUpdated', { status });
    }

    return res.json({ message: `All students marked as ${status}.` });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 6. Finalize Session (Lecturer / Admin)
router.post('/session/:sessionId/finalize', authenticateToken, requireRole(['LECTURER', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  const { sessionId } = req.params;

  try {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        courseOffering: {
          include: {
            enrollments: { where: { status: 'REGISTERED' } }
          }
        },
        records: true
      }
    });

    if (!session) {
      return res.status(404).json({ message: 'Attendance session not found.' });
    }

    await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED' }
    });

    const enrolledStudentIds = session.courseOffering.enrollments.map(e => e.studentId);
    const existingRecordStudentIds = session.records.map(r => r.studentId);
    const absentStudentIds = enrolledStudentIds.filter(id => !existingRecordStudentIds.includes(id));

    if (absentStudentIds.length > 0) {
      await prisma.attendanceRecord.createMany({
        data: absentStudentIds.map(studentId => ({
          sessionId,
          studentId,
          status: 'ABSENT',
          markedMethod: 'MANUAL',
          updatedById: req.user!.id,
          updateReason: 'Session finalized: Auto marked absent'
        }))
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`session_${sessionId}`).emit('sessionFinalized');
    }

    return res.json({ message: 'Attendance session finalized.' });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
