import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import prisma from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// Helper to get Admin's department ID
function getAdminDeptId(req: AuthRequest): string | undefined {
  return req.user?.profile?.departmentId || undefined;
}

// 1. Dashboard Statistics (Department Scoped)
router.get('/dashboard', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const deptId = getAdminDeptId(req);
    const deptFilter = deptId ? { departmentId: deptId } : {};

    const totalStudents = await prisma.student.count({ where: deptFilter });
    const totalLecturers = await prisma.lecturer.count({ where: deptFilter });
    const totalCourses = await prisma.course.count({ where: deptFilter });
    
    // Attendance Rate Today for Department
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendanceRecordsToday = await prisma.attendanceRecord.findMany({
      where: {
        createdAt: { gte: today },
        student: deptFilter
      }
    });
    
    let attendanceRate = 0;
    if (attendanceRecordsToday.length > 0) {
      const presentCount = attendanceRecordsToday.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
      attendanceRate = Math.round((presentCount / attendanceRecordsToday.length) * 100);
    } else {
      attendanceRate = 92; 
    }

    // Fee collection stats
    const totalDuesSum = await prisma.fee.aggregate({
      where: { student: deptFilter },
      _sum: { amount: true }
    });
    const paidSum = await prisma.payment.aggregate({
      where: { fee: { student: deptFilter } },
      _sum: { amount: true }
    });

    const totalDue = totalDuesSum._sum.amount || 0;
    const totalPaid = paidSum._sum.amount || 0;
    const unpaidAmount = Math.max(0, totalDue - totalPaid);

    // Recent activity
    const auditLogs = await prisma.auditLog.findMany({
      take: 6,
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { email: true, role: true } }
      }
    });

    const deptInfo = deptId ? await prisma.department.findUnique({ where: { id: deptId } }) : null;

    return res.json({
      totalStudents,
      totalLecturers,
      totalCourses,
      attendanceRate,
      feeStats: {
        totalDue,
        totalPaid,
        unpaidAmount
      },
      auditLogs,
      department: deptInfo
    });
  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// Get Admin's Department Info
router.get('/my-department', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const deptId = getAdminDeptId(req);
    if (!deptId) {
      return res.json({ department: null });
    }
    const dept = await prisma.department.findUnique({
      where: { id: deptId },
      include: {
        sections: true,
        programs: true
      }
    });
    return res.json(dept);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 2. Students CRUD (Department Scoped)
router.get('/students', authenticateToken, requireRole(['ADMIN', 'LECTURER']), async (req: AuthRequest, res: Response) => {
  try {
    const deptId = getAdminDeptId(req);
    const students = await prisma.student.findMany({
      where: deptId ? { departmentId: deptId } : {},
      include: {
        department: true,
        program: true,
        section: true,
        user: { select: { email: true } }
      },
      orderBy: { name: 'asc' }
    });
    return res.json(students);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.post('/students', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const deptId = getAdminDeptId(req);
  const { name, email, rollNumber, phone, programId, sectionId, admissionYear } = req.body;
  const targetDeptId = deptId || req.body.departmentId;

  if (!name || !email || !rollNumber || !admissionYear) {
    return res.status(400).json({ message: 'Name, email, roll number, and admission year are required.' });
  }

  try {
    const defaultPassword = 'student123';
    const passwordHash = bcrypt.hashSync(defaultPassword, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'STUDENT'
      }
    });

    const student = await prisma.student.create({
      data: {
        userId: user.id,
        name,
        rollNumber,
        email,
        phone,
        departmentId: targetDeptId,
        programId,
        sectionId,
        admissionYear: parseInt(admissionYear)
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE_STUDENT',
        details: `Created student ${name} (${rollNumber}) in department ID ${targetDeptId}.`
      }
    });

    return res.status(201).json(student);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Roll number or email already exists.' });
    }
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.put('/students/:id', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, phone, programId, sectionId, admissionYear } = req.body;
  const deptId = getAdminDeptId(req);

  try {
    const student = await prisma.student.update({
      where: { id },
      data: {
        name,
        phone,
        departmentId: deptId || undefined,
        programId,
        sectionId,
        admissionYear: admissionYear ? parseInt(admissionYear) : undefined
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE_STUDENT',
        details: `Updated student ${student.name} profile.`
      }
    });

    return res.json(student);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.delete('/students/:id', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    await prisma.user.delete({
      where: { id: student.userId }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE_STUDENT',
        details: `Deleted student ${student.name} (${student.rollNumber}).`
      }
    });

    return res.json({ message: 'Student deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 3. Lecturers CRUD (Department Scoped)
router.get('/lecturers', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const deptId = getAdminDeptId(req);
    const lecturers = await prisma.lecturer.findMany({
      where: deptId ? { departmentId: deptId } : {},
      include: {
        department: true,
        user: { select: { email: true } }
      },
      orderBy: { name: 'asc' }
    });
    return res.json(lecturers);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.post('/lecturers', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const deptId = getAdminDeptId(req);
  const { name, email, employeeId, phone } = req.body;
  const targetDeptId = deptId || req.body.departmentId;

  if (!name || !email || !employeeId) {
    return res.status(400).json({ message: 'Name, email, and employee ID are required.' });
  }

  try {
    const defaultPassword = 'lecturer123';
    const passwordHash = bcrypt.hashSync(defaultPassword, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'LECTURER'
      }
    });

    const lecturer = await prisma.lecturer.create({
      data: {
        userId: user.id,
        name,
        employeeId,
        email,
        phone,
        departmentId: targetDeptId
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE_LECTURER',
        details: `Created lecturer ${name} with ID ${employeeId}.`
      }
    });

    return res.status(201).json(lecturer);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Employee ID or email already exists.' });
    }
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 4. Courses (Department Scoped)
router.get('/courses', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const deptId = getAdminDeptId(req);
    const courses = await prisma.course.findMany({
      where: deptId ? { departmentId: deptId } : {},
      include: { department: true },
      orderBy: { code: 'asc' }
    });
    return res.json(courses);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.post('/courses', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const deptId = getAdminDeptId(req);
  const { name, code, creditHours } = req.body;
  const targetDeptId = deptId || req.body.departmentId;

  if (!name || !code || !creditHours) {
    return res.status(400).json({ message: 'Name, code, and credit hours are required.' });
  }

  try {
    const course = await prisma.course.create({
      data: {
        name,
        code,
        creditHours: parseInt(creditHours),
        departmentId: targetDeptId
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE_COURSE',
        details: `Created course ${name} (${code}).`
      }
    });

    return res.status(201).json(course);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Course code already exists.' });
    }
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 5. Department Sections Management
router.get('/department-sections', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const deptId = getAdminDeptId(req);
    const sections = await prisma.section.findMany({
      where: deptId ? { departmentId: deptId } : {},
      include: {
        department: true,
        _count: { select: { students: true, courseOfferings: true } }
      },
      orderBy: { name: 'asc' }
    });
    return res.json(sections);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.post('/department-sections', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const deptId = getAdminDeptId(req);
  const { name, academicYear = '2026-2027', semester = 'Fall 2026' } = req.body;
  const targetDeptId = deptId || req.body.departmentId;

  if (!name || !targetDeptId) {
    return res.status(400).json({ message: 'Section name and department are required.' });
  }

  try {
    const section = await prisma.section.create({
      data: {
        name,
        academicYear,
        semester,
        departmentId: targetDeptId
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE_SECTION',
        details: `Created section ${name} for department ID ${targetDeptId}.`
      }
    });

    return res.status(201).json(section);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 6. Lecturer-Section Assignments
router.get('/lecturer-assignments', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const deptId = getAdminDeptId(req);
    const list = await prisma.lecturerSectionAssignment.findMany({
      where: deptId ? { departmentId: deptId } : {},
      include: {
        lecturer: true,
        section: true,
        department: true
      }
    });
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.post('/lecturer-assignments', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const deptId = getAdminDeptId(req);
  const { lecturerId, sectionId } = req.body;

  if (!lecturerId || !sectionId) {
    return res.status(400).json({ message: 'Lecturer ID and Section ID are required.' });
  }

  try {
    const section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) return res.status(404).json({ message: 'Section not found.' });

    const assignment = await prisma.lecturerSectionAssignment.create({
      data: {
        lecturerId,
        sectionId,
        departmentId: deptId || section.departmentId
      },
      include: {
        lecturer: true,
        section: true
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('lecturerAssignmentUpdated', { sectionId });
    }

    return res.status(201).json(assignment);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Lecturer is already assigned to this section.' });
    }
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.delete('/lecturer-assignments/:id', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.lecturerSectionAssignment.delete({ where: { id } });
    return res.json({ message: 'Assignment removed.' });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 7. Course Offerings Management
router.get('/course-offerings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const deptId = getAdminDeptId(req);
    const offerings = await prisma.courseOffering.findMany({
      where: deptId ? { course: { departmentId: deptId } } : {},
      include: {
        course: true,
        section: true,
        lecturer: true,
        _count: { select: { enrollments: true } }
      },
      orderBy: { semester: 'desc' }
    });
    return res.json(offerings);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

router.post('/course-offerings', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { courseId, sectionId, lecturerId, semester = 'Fall 2026', academicYear = '2026-2027', capacity = 40 } = req.body;

  if (!courseId || !sectionId || !lecturerId) {
    return res.status(400).json({ message: 'Course, section, and lecturer are required.' });
  }

  try {
    const offering = await prisma.courseOffering.create({
      data: {
        courseId,
        sectionId,
        lecturerId,
        semester,
        academicYear,
        capacity: parseInt(capacity)
      },
      include: {
        course: true,
        section: true,
        lecturer: true
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('courseOfferingCreated', { sectionId });
    }

    return res.status(201).json(offering);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 8. Departments List
router.get('/departments', authenticateToken, async (req: Request, res: Response) => {
  try {
    const list = await prisma.department.findMany({ include: { programs: true, sections: true } });
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 9. Fees & Invoices
router.get('/fees', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const deptId = getAdminDeptId(req);
    const list = await prisma.fee.findMany({
      where: deptId ? { student: { departmentId: deptId } } : {},
      include: {
        student: true,
        payments: true
      },
      orderBy: { dueDate: 'desc' }
    });
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// 10. Audit logs
router.get('/auditlogs', authenticateToken, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      take: 20,
      include: {
        user: { select: { email: true, role: true } }
      },
      orderBy: { timestamp: 'desc' }
    });
    return res.json(logs);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
