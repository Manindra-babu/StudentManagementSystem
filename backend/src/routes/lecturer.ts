import { Router, Response } from 'express';
import prisma from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// 1. Lecturer Dashboard Stats
router.get('/dashboard', authenticateToken, requireRole(['LECTURER']), async (req: AuthRequest, res: Response) => {
  const lecturerId = req.user!.profile.id;

  try {
    const courseOfferings = await prisma.courseOffering.findMany({
      where: { lecturerId },
      include: {
        course: true,
        section: { include: { department: true } },
        timetable: true,
        _count: { select: { enrollments: { where: { status: 'REGISTERED' } } } }
      }
    });

    const offeringIds = courseOfferings.map(o => o.id);

    // Today's classes
    const todayNum = new Date().getDay();
    const todayClasses = courseOfferings.flatMap(o => 
      o.timetable
        .filter(t => t.dayOfWeek === todayNum)
        .map(t => ({
          courseOfferingId: o.id,
          courseName: o.course.name,
          courseCode: o.course.code,
          sectionName: o.section.name,
          departmentName: o.section.department.name,
          startTime: t.startTime,
          endTime: t.endTime,
          room: t.room,
          enrolledCount: o._count.enrollments
        }))
    );

    // Pending assignments to grade
    const pendingGradingCount = await prisma.submission.count({
      where: {
        assignment: { courseOfferingId: { in: offeringIds } },
        pointsObtained: null
      }
    });

    // Upcoming exams
    const upcomingExams = await prisma.exam.findMany({
      where: {
        courseOfferingId: { in: offeringIds },
        date: { gte: new Date() }
      },
      include: { courseOffering: { include: { course: true, section: true } } },
      orderBy: { date: 'asc' },
      take: 5
    });

    return res.json({
      todayClasses,
      pendingGradingCount,
      upcomingExams: upcomingExams.map(e => ({
        id: e.id,
        title: e.title,
        date: e.date,
        courseCode: e.courseOffering.course.code,
        sectionName: e.courseOffering.section.name,
        maxPoints: e.maxPoints
      }))
    });
  } catch (error) {
    console.error('Lecturer dashboard stats error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 2. Get Lecturer Assigned Course Offerings (Grouped by Section)
router.get('/sections', authenticateToken, requireRole(['LECTURER']), async (req: AuthRequest, res: Response) => {
  const lecturerId = req.user!.profile.id;
  try {
    const list = await prisma.courseOffering.findMany({
      where: { lecturerId },
      include: {
        course: true,
        section: { include: { department: true } },
        timetable: true,
        _count: { select: { enrollments: { where: { status: 'REGISTERED' } } } }
      },
      orderBy: { section: { name: 'asc' } }
    });
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 3. Gradebook (Consolidated list of marks per offering)
router.get('/sections/:offeringId/gradebook', authenticateToken, requireRole(['LECTURER']), async (req: AuthRequest, res: Response) => {
  const { offeringId } = req.params;
  const lecturerId = req.user!.profile.id;

  try {
    const offering = await prisma.courseOffering.findFirst({
      where: { id: offeringId, lecturerId }
    });
    if (!offering) return res.status(403).json({ message: 'Access denied.' });

    const enrollments = await prisma.enrollment.findMany({
      where: { courseOfferingId: offeringId, status: 'REGISTERED' },
      include: { student: true }
    });

    const assignments = await prisma.assignment.findMany({ where: { courseOfferingId: offeringId } });
    const exams = await prisma.exam.findMany({ where: { courseOfferingId: offeringId } });

    const studentIds = enrollments.map(e => e.studentId);
    const submissions = await prisma.submission.findMany({
      where: { assignmentId: { in: assignments.map(a => a.id) }, studentId: { in: studentIds } }
    });
    const grades = await prisma.grade.findMany({
      where: { examId: { in: exams.map(e => e.id) }, studentId: { in: studentIds } }
    });

    const matrix = enrollments.map(e => {
      const student = e.student;
      const studentSubs = submissions.filter(s => s.studentId === student.id);
      const studentGrades = grades.filter(g => g.studentId === student.id);

      return {
        studentId: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        assignments: assignments.map(a => {
          const sub = studentSubs.find(s => s.assignmentId === a.id);
          return {
            assignmentId: a.id,
            title: a.title,
            maxPoints: a.maxPoints,
            pointsObtained: sub ? sub.pointsObtained : null,
            grade: sub ? sub.grade : null,
            submitted: !!sub
          };
        }),
        exams: exams.map(ex => {
          const gr = studentGrades.find(g => g.examId === ex.id);
          return {
            examId: ex.id,
            title: ex.title,
            maxPoints: ex.maxPoints,
            pointsObtained: gr ? gr.pointsObtained : null,
            letterGrade: gr ? gr.letterGrade : null
          };
        })
      };
    });

    return res.json({ assignments, exams, matrix });
  } catch (error) {
    console.error('Gradebook compile error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 4. Assignments CRUD for Lecturers
router.get('/assignments', authenticateToken, requireRole(['LECTURER']), async (req: AuthRequest, res: Response) => {
  const lecturerId = req.user!.profile.id;
  try {
    const list = await prisma.assignment.findMany({
      where: { courseOffering: { lecturerId } },
      include: { courseOffering: { include: { course: true, section: true } } },
      orderBy: { dueDate: 'desc' }
    });
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.post('/assignments', authenticateToken, requireRole(['LECTURER']), async (req: AuthRequest, res: Response) => {
  const { courseOfferingId, title, description, dueDate, maxPoints } = req.body;
  const lecturerId = req.user!.profile.id;

  if (!courseOfferingId || !title || !dueDate || !maxPoints) {
    return res.status(400).json({ message: 'Required fields missing.' });
  }

  try {
    const offering = await prisma.courseOffering.findFirst({
      where: { id: courseOfferingId, lecturerId }
    });
    if (!offering) return res.status(403).json({ message: 'Access denied.' });

    const assignment = await prisma.assignment.create({
      data: {
        courseOfferingId,
        title,
        description,
        dueDate: new Date(dueDate),
        maxPoints: parseInt(maxPoints)
      }
    });

    return res.status(201).json(assignment);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 5. Grade Submissions
router.get('/assignments/:assignmentId/submissions', authenticateToken, requireRole(['LECTURER']), async (req: AuthRequest, res: Response) => {
  const { assignmentId } = req.params;
  const lecturerId = req.user!.profile.id;

  try {
    const assign = await prisma.assignment.findFirst({
      where: { id: assignmentId, courseOffering: { lecturerId } }
    });
    if (!assign) return res.status(403).json({ message: 'Access denied.' });

    const submissions = await prisma.submission.findMany({
      where: { assignmentId },
      include: { student: true }
    });

    return res.json({ assignment: assign, submissions });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.post('/submissions/:submissionId/grade', authenticateToken, requireRole(['LECTURER']), async (req: AuthRequest, res: Response) => {
  const { submissionId } = req.params;
  const { pointsObtained, grade, feedback } = req.body;
  const lecturerId = req.user!.profile.id;

  if (pointsObtained === undefined || !grade) {
    return res.status(400).json({ message: 'Points obtained and letter grade are required.' });
  }

  try {
    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { assignment: { include: { courseOffering: true } } }
    });

    if (!sub || sub.assignment.courseOffering.lecturerId !== lecturerId) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const updated = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        pointsObtained: parseFloat(pointsObtained),
        grade,
        feedback,
        gradedById: lecturerId,
        gradedAt: new Date()
      },
      include: { student: true }
    });

    await prisma.notification.create({
      data: {
        userId: updated.student.userId,
        content: `Your assignment "${sub.assignment.title}" has been graded. Grade: ${grade}`
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'GRADE_SUBMISSION',
        details: `Graded assignment ${sub.assignment.title} for student ${updated.student.name} with score ${pointsObtained} (${grade}).`
      }
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 6. Exams & Marks posting
router.get('/exams', authenticateToken, requireRole(['LECTURER']), async (req: AuthRequest, res: Response) => {
  const lecturerId = req.user!.profile.id;
  try {
    const list = await prisma.exam.findMany({
      where: { courseOffering: { lecturerId } },
      include: { courseOffering: { include: { course: true, section: true } } },
      orderBy: { date: 'desc' }
    });
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.post('/exams', authenticateToken, requireRole(['LECTURER']), async (req: AuthRequest, res: Response) => {
  const { courseOfferingId, title, date, maxPoints, weight } = req.body;
  const lecturerId = req.user!.profile.id;

  if (!courseOfferingId || !title || !date || !maxPoints || !weight) {
    return res.status(400).json({ message: 'Required fields missing.' });
  }

  try {
    const offering = await prisma.courseOffering.findFirst({
      where: { id: courseOfferingId, lecturerId }
    });
    if (!offering) return res.status(403).json({ message: 'Access denied.' });

    const exam = await prisma.exam.create({
      data: {
        courseOfferingId,
        title,
        date: new Date(date),
        maxPoints: parseInt(maxPoints),
        weight: parseFloat(weight)
      }
    });

    return res.status(201).json(exam);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.post('/exams/:examId/grade', authenticateToken, requireRole(['LECTURER']), async (req: AuthRequest, res: Response) => {
  const { examId } = req.params;
  const { studentId, pointsObtained, letterGrade } = req.body;
  const lecturerId = req.user!.profile.id;

  if (!studentId || pointsObtained === undefined || !letterGrade) {
    return res.status(400).json({ message: 'Required grade fields missing.' });
  }

  try {
    const exam = await prisma.exam.findFirst({
      where: { id: examId, courseOffering: { lecturerId } }
    });
    if (!exam) return res.status(403).json({ message: 'Access denied.' });

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const gr = await prisma.grade.upsert({
      where: {
        examId_studentId: {
          examId,
          studentId
        }
      },
      update: {
        pointsObtained: parseFloat(pointsObtained),
        letterGrade,
        gradedById: lecturerId,
        gradedAt: new Date()
      },
      create: {
        examId,
        studentId,
        pointsObtained: parseFloat(pointsObtained),
        letterGrade,
        gradedById: lecturerId,
        gradedAt: new Date()
      }
    });

    await prisma.notification.create({
      data: {
        userId: student.userId,
        content: `Your result for exam "${exam.title}" has been published. Grade: ${letterGrade}`
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'GRADE_EXAM',
        details: `Posted grade for exam ${exam.title} and student ${student.name} with score ${pointsObtained} (${letterGrade}).`
      }
    });

    return res.json(gr);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
