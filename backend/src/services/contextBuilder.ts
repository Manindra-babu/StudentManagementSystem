import prisma from '../db';
import { AuthRequest } from '../middleware/auth';

export async function buildUserContext(req: AuthRequest): Promise<{ systemPrompt: string; contextData: any }> {
  const user = req.user;
  if (!user) {
    throw new Error('Unauthenticated user for context builder');
  }

  const role = user.role;
  const profile = user.profile;

  if (role === 'STUDENT' && profile) {
    const studentId = profile.id;

    // Fetch student's enrollments
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

    // Per-course attendance calculation
    const courseAttendance: Array<{ courseCode: string; courseName: string; percentage: number; attended: number; total: number }> = [];
    let totalAttendedSum = 0;
    let totalSessionsSum = 0;

    for (const env of enrollments) {
      const offId = env.courseOfferingId;
      const totalSessions = await prisma.attendanceSession.count({ where: { courseOfferingId: offId } });
      const attendedCount = await prisma.attendanceRecord.count({
        where: {
          studentId,
          session: { courseOfferingId: offId },
          status: { in: ['PRESENT', 'LATE'] }
        }
      });
      const pct = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 100;
      courseAttendance.push({
        courseCode: env.courseOffering.course.code,
        courseName: env.courseOffering.course.name,
        percentage: pct,
        attended: attendedCount,
        total: totalSessions
      });
      totalAttendedSum += attendedCount;
      totalSessionsSum += totalSessions;
    }

    const overallPct = totalSessionsSum > 0 ? Math.round((totalAttendedSum / totalSessionsSum) * 100) : 95;

    // Recent 10 attendance records
    const recentAttendance = await prisma.attendanceRecord.findMany({
      where: { studentId },
      take: 10,
      orderBy: { markedAt: 'desc' },
      include: { session: { include: { courseOffering: { include: { course: true } } } } }
    });

    // Upcoming exams
    const upcomingExams = await prisma.exam.findMany({
      where: {
        courseOfferingId: { in: offeringIds },
        date: { gte: new Date() }
      },
      include: { courseOffering: { include: { course: true } } },
      orderBy: { date: 'asc' }
    });

    // Pending assignments
    const pendingAssignments = await prisma.assignment.findMany({
      where: {
        courseOfferingId: { in: offeringIds },
        dueDate: { gte: new Date() }
      },
      include: {
        courseOffering: { include: { course: true } },
        submissions: { where: { studentId } }
      },
      orderBy: { dueDate: 'asc' }
    });

    const unsubmitted = pendingAssignments.filter(a => a.submissions.length === 0);

    // Fees status
    const fees = await prisma.fee.findMany({
      where: { studentId },
      orderBy: { dueDate: 'desc' }
    });

    const contextData = {
      role: 'STUDENT',
      name: profile.name,
      rollNumber: profile.rollNumber,
      department: profile.department?.name || 'N/A',
      section: profile.section?.name || 'N/A',
      courses: enrollments.map(e => ({
        code: e.courseOffering.course.code,
        name: e.courseOffering.course.name,
        lecturer: e.courseOffering.lecturer.name,
        credits: e.courseOffering.course.creditHours
      })),
      attendance: {
        overall: overallPct,
        breakdown: courseAttendance
      },
      upcomingExams: upcomingExams.map(e => ({ title: e.title, course: e.courseOffering.course.code, date: e.date.toISOString().split('T')[0] })),
      pendingAssignments: unsubmitted.map(a => ({ title: a.title, course: a.courseOffering.course.code, dueDate: a.dueDate.toISOString().split('T')[0] })),
      fees: fees.map(f => ({ title: f.title, amount: f.amount, status: f.status, dueDate: f.dueDate.toISOString().split('T')[0] }))
    };

    const systemPrompt = `You are Academix AI Assistant for the Student Portal.
You are speaking with Student: ${profile.name} (Roll: ${profile.rollNumber}) in Department of ${contextData.department}, Section ${contextData.section}.

STUDENT'S REAL-TIME DATABASE CONTEXT:
- Enrolled Courses: ${JSON.stringify(contextData.courses)}
- Attendance Summary: Overall ${overallPct}%. Course Breakdown: ${JSON.stringify(courseAttendance)}
- Recent Attendance Logs: ${JSON.stringify(recentAttendance.map(r => ({ course: r.session.courseOffering.course.code, status: r.status, date: r.markedAt.toISOString().split('T')[0] })))}
- Upcoming Exams: ${JSON.stringify(contextData.upcomingExams)}
- Pending Assignments Due: ${JSON.stringify(contextData.pendingAssignments)}
- Fee Invoices: ${JSON.stringify(contextData.fees)}

GUIDELINES & GUARDRAILS:
1. Answer questions strictly using this student's context. Never invent data.
2. If attendance is requested, show exact percentages and calculate how many classes can be missed before dropping below 75%.
3. You are READ-ONLY. You cannot perform actions directly, but you can guide the student using navigation actions.
4. When suggesting an action (e.g. course registration, viewing grades, paying fees, QR checkin), append a structured action tag at the very end of your response in format: [ACTION:navigate:ROUTE] where ROUTE is one of: 'registration', 'courses', 'checkin', 'assignments', 'grades', 'fees'.
5. Keep responses concise, helpful, and professional.`;

    return { systemPrompt, contextData };

  } else if (role === 'LECTURER' && profile) {
    const lecturerId = profile.id;

    // Assigned Course Offerings
    const offerings = await prisma.courseOffering.findMany({
      where: { lecturerId },
      include: {
        course: true,
        section: { include: { department: true } },
        timetable: true,
        enrollments: { where: { status: 'REGISTERED' }, include: { student: true } }
      }
    });

    const offeringIds = offerings.map(o => o.id);

    // Today's classes
    const todayNum = new Date().getDay();
    const todayClasses = offerings.flatMap(o =>
      o.timetable
        .filter(t => t.dayOfWeek === todayNum)
        .map(t => ({
          courseOfferingId: o.id,
          course: o.course.code,
          section: o.section.name,
          time: `${t.startTime} - ${t.endTime}`,
          room: t.room,
          enrolled: o.enrollments.length
        }))
    );

    // Students below 75% attendance threshold per offering
    const lowAttendanceStudents: Array<{ studentName: string; rollNumber: string; section: string; courseCode: string; percentage: number }> = [];

    for (const off of offerings) {
      const totalSessions = await prisma.attendanceSession.count({ where: { courseOfferingId: off.id } });
      if (totalSessions > 0) {
        for (const env of off.enrollments) {
          const attended = await prisma.attendanceRecord.count({
            where: {
              studentId: env.studentId,
              session: { courseOfferingId: off.id },
              status: { in: ['PRESENT', 'LATE'] }
            }
          });
          const pct = Math.round((attended / totalSessions) * 100);
          if (pct < 75) {
            lowAttendanceStudents.push({
              studentName: env.student.name,
              rollNumber: env.student.rollNumber,
              section: off.section.name,
              courseCode: off.course.code,
              percentage: pct
            });
          }
        }
      }
    }

    // Pending gradings
    const pendingSubmissions = await prisma.submission.count({
      where: {
        assignment: { courseOfferingId: { in: offeringIds } },
        pointsObtained: null
      }
    });

    const contextData = {
      role: 'LECTURER',
      name: profile.name,
      employeeId: profile.employeeId,
      department: profile.department?.name || 'N/A',
      assignedClasses: offerings.map(o => ({
        course: `${o.course.name} (${o.course.code})`,
        section: o.section.name,
        enrolledCount: o.enrollments.length
      })),
      todayClasses,
      pendingGradingCount: pendingSubmissions,
      lowAttendanceStudents
    };

    const systemPrompt = `You are Academix AI Assistant for the Faculty Lecturer Portal.
You are speaking with Lecturer: ${profile.name} (${profile.employeeId}) in Department of ${contextData.department}.

FACULTY LECTURER REAL-TIME DATABASE CONTEXT:
- Assigned Course Sections: ${JSON.stringify(contextData.assignedClasses)}
- Today's Class Schedule: ${JSON.stringify(contextData.todayClasses)}
- Submissions Pending Grading: ${pendingSubmissions}
- Students Below 75% Attendance Threshold: ${JSON.stringify(lowAttendanceStudents)}

GUIDELINES & GUARDRAILS:
1. Answer strictly using this lecturer's assigned classes context. Never reveal data from other departments or unassigned sections.
2. If asked about low attendance, list the names, sections, and exact percentages.
3. You are READ-ONLY. Guide the lecturer on using portal controls.
4. When suggesting an action (e.g. generating QR attendance, reviewing assignments, posting grades), append a structured action tag at the end in format: [ACTION:navigate:ROUTE] where ROUTE is one of: 'attendance-start', 'assignments', 'exams', 'sections'.
5. Keep answers direct, professional, and concise.`;

    return { systemPrompt, contextData };

  } else if (role === 'ADMIN' && profile) {
    const deptId = profile.departmentId;

    const department = deptId ? await prisma.department.findUnique({ where: { id: deptId } }) : null;
    const deptName = department ? department.name : 'System Core';

    const deptFilter = deptId ? { departmentId: deptId } : {};

    const totalStudents = await prisma.student.count({ where: deptFilter });
    const totalLecturers = await prisma.lecturer.count({ where: deptFilter });
    const totalCourses = await prisma.course.count({ where: deptFilter });

    const sections = await prisma.section.findMany({
      where: deptFilter,
      include: { _count: { select: { students: true, courseOfferings: true } } }
    });

    const lecturers = await prisma.lecturer.findMany({
      where: deptFilter,
      include: { sectionAssignments: { include: { section: true } } }
    });

    const feeDues = await prisma.fee.aggregate({
      where: { student: deptFilter },
      _sum: { amount: true }
    });
    const feePaid = await prisma.payment.aggregate({
      where: { fee: { student: deptFilter } },
      _sum: { amount: true }
    });

    const totalDue = feeDues._sum.amount || 0;
    const totalPaid = feePaid._sum.amount || 0;
    const unpaidAmount = Math.max(0, totalDue - totalPaid);

    const contextData = {
      role: 'ADMIN',
      name: profile.name,
      department: deptName,
      metrics: { totalStudents, totalLecturers, totalCourses },
      sections: sections.map(s => ({ name: s.name, academicYear: s.academicYear, studentsEnrolled: s._count.students })),
      faculty: lecturers.map(l => ({ name: l.name, empId: l.employeeId, assignedSections: l.sectionAssignments.map(sa => sa.section.name) })),
      fees: { totalBilled: totalDue, totalCollected: totalPaid, unpaidBalance: unpaidAmount }
    };

    const systemPrompt = `You are Academix AI Assistant for the Department Admin Portal.
You are speaking with Admin: ${profile.name}, managing Department: ${deptName}.

DEPARTMENT ADMIN REAL-TIME DATABASE CONTEXT:
- Department Metrics: Total Students: ${totalStudents}, Total Faculty: ${totalLecturers}, Total Courses: ${totalCourses}
- Active Sections: ${JSON.stringify(contextData.sections)}
- Faculty Roster & Section Assignments: ${JSON.stringify(contextData.faculty)}
- Department Financial Overview: Total Billed: $${totalDue}, Collected: $${totalPaid}, Unpaid Balance: $${unpaidAmount}

GUIDELINES & GUARDRAILS:
1. Answer questions strictly using this department's context. Never leak data outside this admin's department.
2. You are READ-ONLY. Guide the admin to proper portal tabs to perform creations/edits.
3. When suggesting an action (e.g. creating sections, assigning lecturers, creating course offerings, managing students), append a structured action tag at the end in format: [ACTION:navigate:ROUTE] where ROUTE is one of: 'dept-sections', 'lecturer-assign', 'course-offerings', 'students', 'lecturers', 'courses', 'fees'.
4. Keep answers concise, factual, and professional.`;

    return { systemPrompt, contextData };

  } else {
    // Fallback general context
    return {
      systemPrompt: `You are Academix AI Assistant. Provide helpful, read-only guidance about using the Academix portal.`,
      contextData: { role: 'GENERAL' }
    };
  }
}
