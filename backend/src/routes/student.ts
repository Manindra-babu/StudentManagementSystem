import { Router, Response } from 'express';
import prisma from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { generateFeeReceipt, generateReportCard } from '../services/pdfService';

const router = Router();

// 1. Student Dashboard Aggregates
router.get('/dashboard', authenticateToken, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.profile.id;

  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId, status: 'REGISTERED' },
      include: {
        courseOffering: {
          include: {
            course: true,
            lecturer: true,
            section: true,
            timetable: true
          }
        }
      }
    });

    const offeringIds = enrollments.map(e => e.courseOfferingId);

    // Timetable for today
    const todayNum = new Date().getDay();
    const todayClasses = enrollments.flatMap(e =>
      e.courseOffering.timetable
        .filter(t => t.dayOfWeek === todayNum)
        .map(t => ({
          courseName: e.courseOffering.course.name,
          courseCode: e.courseOffering.course.code,
          sectionName: e.courseOffering.section.name,
          lecturerName: e.courseOffering.lecturer.name,
          startTime: t.startTime,
          endTime: t.endTime,
          room: t.room
        }))
    );

    // Calculate personal attendance rate
    const totalSessions = await prisma.attendanceSession.count({
      where: { courseOfferingId: { in: offeringIds } }
    });

    const attendedRecords = await prisma.attendanceRecord.findMany({
      where: {
        studentId,
        session: { courseOfferingId: { in: offeringIds } },
        status: { in: ['PRESENT', 'LATE'] }
      }
    });

    const attendanceRate = totalSessions > 0 ? Math.round((attendedRecords.length / totalSessions) * 100) : 95;

    // Upcoming assignments
    const assignments = await prisma.assignment.findMany({
      where: {
        courseOfferingId: { in: offeringIds },
        dueDate: { gte: new Date() }
      },
      include: {
        courseOffering: { include: { course: true } },
        submissions: { where: { studentId } }
      },
      orderBy: { dueDate: 'asc' },
      take: 5
    });

    // Announcements
    const announcements = await prisma.announcement.findMany({
      where: { targetRole: { in: ['ALL', 'STUDENT'] } },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Notifications
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return res.json({
      todayClasses,
      attendanceRate,
      attendanceSummary: {
        totalSessions,
        attended: attendedRecords.length,
        missed: Math.max(0, totalSessions - attendedRecords.length)
      },
      upcomingAssignments: assignments.map(a => ({
        id: a.id,
        title: a.title,
        dueDate: a.dueDate,
        courseCode: a.courseOffering.course.code,
        submitted: a.submissions.length > 0,
        maxPoints: a.maxPoints
      })),
      announcements,
      notifications
    });
  } catch (error) {
    console.error('Student dashboard error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 2. Fetch Enrolled Courses
router.get('/courses', authenticateToken, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.profile.id;

  try {
    const list = await prisma.enrollment.findMany({
      where: { studentId, status: 'REGISTERED' },
      include: {
        courseOffering: {
          include: {
            course: true,
            lecturer: true,
            section: true,
            timetable: true
          }
        }
      }
    });
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 3. Course Registration Flow Endpoints
router.get('/registration/offerings', authenticateToken, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  const student = req.user!.profile;
  const sectionId = student.sectionId;
  const deptId = student.departmentId;

  try {
    // Fetch offerings matching student's section or department
    const offerings = await prisma.courseOffering.findMany({
      where: sectionId ? { sectionId } : (deptId ? { course: { departmentId: deptId } } : {}),
      include: {
        course: true,
        section: true,
        lecturer: true,
        timetable: true,
        _count: { select: { enrollments: { where: { status: 'REGISTERED' } } } }
      }
    });

    // Existing student enrollments
    const myEnrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: 'REGISTERED' },
      select: { courseOfferingId: true }
    });
    const registeredOfferingIds = myEnrollments.map(e => e.courseOfferingId);

    // Group offerings by Course
    const courseMap = new Map<string, any>();
    for (const off of offerings) {
      const cId = off.course.id;
      if (!courseMap.has(cId)) {
        courseMap.set(cId, {
          courseId: off.course.id,
          courseName: off.course.name,
          courseCode: off.course.code,
          creditHours: off.course.creditHours,
          offerings: []
        });
      }
      const enrolledCount = off._count.enrollments;
      const seatsLeft = Math.max(0, off.capacity - enrolledCount);
      courseMap.get(cId).offerings.push({
        id: off.id,
        lecturerName: off.lecturer.name,
        employeeId: off.lecturer.employeeId,
        semester: off.semester,
        academicYear: off.academicYear,
        capacity: off.capacity,
        enrolledCount,
        seatsLeft,
        isRegistered: registeredOfferingIds.includes(off.id),
        timetable: off.timetable
      });
    }

    return res.json({
      studentInfo: {
        name: student.name,
        rollNumber: student.rollNumber,
        departmentName: student.department?.name || 'N/A',
        sectionName: student.section?.name || 'N/A'
      },
      availableCourses: Array.from(courseMap.values())
    });
  } catch (error) {
    console.error('Fetch registration offerings error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.post('/registration/register', authenticateToken, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.profile.id;
  const { offeringIds } = req.body; // array of selected offering IDs

  if (!offeringIds || !Array.isArray(offeringIds) || offeringIds.length === 0) {
    return res.status(400).json({ message: 'Please select at least one course offering.' });
  }

  try {
    for (const offeringId of offeringIds) {
      const offering = await prisma.courseOffering.findUnique({
        where: { id: offeringId },
        include: { _count: { select: { enrollments: { where: { status: 'REGISTERED' } } } } }
      });

      if (!offering) {
        return res.status(404).json({ message: `Course offering ${offeringId} not found.` });
      }

      if (offering._count.enrollments >= offering.capacity) {
        return res.status(400).json({ message: `Capacity full for offering ID ${offeringId}.` });
      }

      // Upsert enrollment
      await prisma.enrollment.upsert({
        where: {
          studentId_courseOfferingId: {
            studentId,
            courseOfferingId: offeringId
          }
        },
        update: { status: 'REGISTERED', registeredAt: new Date() },
        create: {
          studentId,
          courseOfferingId: offeringId,
          status: 'REGISTERED'
        }
      });
    }

    // Real-time socket notification to lecturer roster
    const io = req.app.get('io');
    if (io) {
      io.emit('enrollmentUpdated');
    }

    return res.json({ message: 'Course registration completed successfully!' });
  } catch (error) {
    console.error('Registration submit error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.post('/registration/drop', authenticateToken, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.profile.id;
  const { courseOfferingId } = req.body;

  if (!courseOfferingId) {
    return res.status(400).json({ message: 'Course offering ID is required.' });
  }

  try {
    await prisma.enrollment.updateMany({
      where: { studentId, courseOfferingId },
      data: { status: 'DROPPED' }
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('enrollmentUpdated');
    }

    return res.json({ message: 'Course dropped successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 4. Assignments list & upload submission
router.get('/assignments', authenticateToken, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.profile.id;

  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId, status: 'REGISTERED' }
    });
    const offeringIds = enrollments.map(e => e.courseOfferingId);

    const list = await prisma.assignment.findMany({
      where: { courseOfferingId: { in: offeringIds } },
      include: {
        courseOffering: { include: { course: true } },
        submissions: { where: { studentId } }
      },
      orderBy: { dueDate: 'desc' }
    });

    return res.json(list);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.post('/assignments/:assignmentId/submit', authenticateToken, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  const { assignmentId } = req.params;
  const { fileName = 'submission.zip' } = req.body;
  const studentId = req.user!.profile.id;

  try {
    const submission = await prisma.submission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId
        }
      },
      update: {
        submittedAt: new Date(),
        fileName,
        filePath: `/uploads/submissions/${studentId}_${assignmentId}.zip`,
        pointsObtained: null,
        grade: null,
        feedback: null
      },
      create: {
        assignmentId,
        studentId,
        submittedAt: new Date(),
        fileName,
        filePath: `/uploads/submissions/${studentId}_${assignmentId}.zip`
      }
    });

    return res.status(201).json(submission);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 5. Grades retrieval and PDF report card
router.get('/grades', authenticateToken, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.profile.id;

  try {
    const grades = await prisma.grade.findMany({
      where: { studentId },
      include: {
        exam: {
          include: {
            courseOffering: { include: { course: true } }
          }
        }
      }
    });
    return res.json(grades);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.get('/grades/report-card', authenticateToken, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.profile.id;

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { department: true, program: true }
    });

    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId, status: 'REGISTERED' },
      include: {
        courseOffering: {
          include: {
            course: true,
            lecturer: true
          }
        }
      }
    });

    const grades = await prisma.grade.findMany({
      where: { studentId },
      include: { exam: true }
    });

    generateReportCard(res, student, enrollments, grades);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 6. Fees & Payments
router.get('/fees', authenticateToken, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.profile.id;

  try {
    const fees = await prisma.fee.findMany({
      where: { studentId },
      include: { payments: true },
      orderBy: { dueDate: 'desc' }
    });
    return res.json(fees);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.post('/fees/:feeId/pay', authenticateToken, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  const { feeId } = req.params;
  const { method = 'CARD' } = req.body;
  const studentId = req.user!.profile.id;

  try {
    const fee = await prisma.fee.findFirst({
      where: { id: feeId, studentId }
    });

    if (!fee) return res.status(404).json({ message: 'Invoice not found or access denied.' });
    if (fee.status === 'PAID') return res.status(400).json({ message: 'This fee is already paid.' });

    const txnId = `TXN${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;

    const [payment, updatedFee] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          feeId,
          amount: fee.amount,
          method,
          transactionId: txnId
        }
      }),
      prisma.fee.update({
        where: { id: feeId },
        data: { status: 'PAID' }
      })
    ]);

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'PAY_FEE',
        details: `Student paid fee "${fee.title}" ($${fee.amount}) with method ${method}. Transaction ID: ${txnId}`
      }
    });

    return res.json({ message: 'Payment recorded successfully.', payment, fee: updatedFee });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.get('/payments/:paymentId/receipt', authenticateToken, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  const { paymentId } = req.params;
  const studentId = req.user!.profile.id;

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        fee: {
          include: {
            student: {
              include: { department: true }
            }
          }
        }
      }
    });

    if (!payment || payment.fee.studentId !== studentId) {
      return res.status(404).json({ message: 'Receipt not found.' });
    }

    generateFeeReceipt(res, payment);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 7. Attendance heat map
router.get('/attendance', authenticateToken, requireRole(['STUDENT']), async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.profile.id;

  try {
    const records = await prisma.attendanceRecord.findMany({
      where: { studentId },
      include: {
        session: {
          include: {
            courseOffering: {
              include: { course: true }
            }
          }
        }
      },
      orderBy: { markedAt: 'desc' }
    });
    return res.json(records);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
