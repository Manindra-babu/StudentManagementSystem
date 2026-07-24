import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database...');
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.fee.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.attendanceSession.deleteMany();
  await prisma.timetable.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.courseOffering.deleteMany();
  await prisma.lecturerSectionAssignment.deleteMany();
  await prisma.section.deleteMany();
  await prisma.course.deleteMany();
  await prisma.program.deleteMany();
  await prisma.student.deleteMany();
  await prisma.lecturer.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding departments...');
  const csDept = await prisma.department.create({
    data: { name: 'Computer Science & Engineering', code: 'CSE' },
  });
  const eeDept = await prisma.department.create({
    data: { name: 'Electrical & Electronics Engineering', code: 'EEE' },
  });

  console.log('Seeding sections...');
  const secCS_A = await prisma.section.create({
    data: { name: 'CSE-A', academicYear: '2026-2027', semester: 'Fall 2026', departmentId: csDept.id }
  });
  const secCS_B = await prisma.section.create({
    data: { name: 'CSE-B', academicYear: '2026-2027', semester: 'Fall 2026', departmentId: csDept.id }
  });
  const secEE_A = await prisma.section.create({
    data: { name: 'EEE-A', academicYear: '2026-2027', semester: 'Fall 2026', departmentId: eeDept.id }
  });

  console.log('Seeding programs...');
  const csBtech = await prisma.program.create({
    data: { name: 'Bachelor of Technology in CS', code: 'BTECH-CS', departmentId: csDept.id },
  });
  const csMtech = await prisma.program.create({
    data: { name: 'Master of Technology in CS', code: 'MTECH-CS', departmentId: csDept.id },
  });
  const eeBtech = await prisma.program.create({
    data: { name: 'Bachelor of Technology in EE', code: 'BTECH-EE', departmentId: eeDept.id },
  });

  const passwordHash = bcrypt.hashSync('password123', 10);

  console.log('Seeding admin user (scoped to CSE Department)...');
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@academix.edu',
      passwordHash,
      role: 'ADMIN',
    },
  });
  await prisma.admin.create({
    data: {
      userId: adminUser.id,
      name: 'System Administrator',
      employeeId: 'ADM001',
      email: 'admin@academix.edu',
      phone: '+1 555-0100',
      departmentId: csDept.id,
    },
  });

  console.log('Seeding lecturers...');
  const lecturersData = [
    { name: 'Dr. Sarah Connor', email: 'sarah.connor@academix.edu', empId: 'LEC001', deptId: csDept.id },
    { name: 'Prof. Charles Xavier', email: 'charles.xavier@academix.edu', empId: 'LEC002', deptId: eeDept.id },
    { name: 'Dr. Alan Turing', email: 'alan.turing@academix.edu', empId: 'LEC003', deptId: csDept.id },
    { name: 'Prof. Grace Hopper', email: 'grace.hopper@academix.edu', empId: 'LEC004', deptId: csDept.id },
    { name: 'Dr. Richard Feynman', email: 'richard.feynman@academix.edu', empId: 'LEC005', deptId: eeDept.id },
  ];

  const lecturers = [];
  for (const lec of lecturersData) {
    const user = await prisma.user.create({
      data: {
        email: lec.email,
        passwordHash,
        role: 'LECTURER',
      },
    });
    const lecturer = await prisma.lecturer.create({
      data: {
        userId: user.id,
        name: lec.name,
        employeeId: lec.empId,
        email: lec.email,
        phone: '+1 555-020' + lec.empId.slice(-1),
        departmentId: lec.deptId,
      },
    });
    lecturers.push(lecturer);
  }

  console.log('Seeding Lecturer-Section Assignments...');
  await prisma.lecturerSectionAssignment.createMany({
    data: [
      { lecturerId: lecturers[0].id, sectionId: secCS_A.id, departmentId: csDept.id },
      { lecturerId: lecturers[2].id, sectionId: secCS_A.id, departmentId: csDept.id },
      { lecturerId: lecturers[3].id, sectionId: secCS_A.id, departmentId: csDept.id },
      { lecturerId: lecturers[0].id, sectionId: secCS_B.id, departmentId: csDept.id },
      { lecturerId: lecturers[1].id, sectionId: secEE_A.id, departmentId: eeDept.id },
      { lecturerId: lecturers[4].id, sectionId: secEE_A.id, departmentId: eeDept.id },
    ]
  });

  console.log('Seeding courses...');
  const cs101 = await prisma.course.create({
    data: { name: 'Introduction to Programming', code: 'CS-101', creditHours: 3, departmentId: csDept.id },
  });
  const cs102 = await prisma.course.create({
    data: { name: 'Data Structures & Algorithms', code: 'CS-102', creditHours: 4, departmentId: csDept.id },
  });
  const cs103 = await prisma.course.create({
    data: { name: 'Database Management Systems', code: 'CS-103', creditHours: 4, departmentId: csDept.id },
  });
  const ee101 = await prisma.course.create({
    data: { name: 'Basic Electrical Engineering', code: 'EE-101', creditHours: 3, departmentId: eeDept.id },
  });

  console.log('Seeding Course Offerings (Multiple Lecturer choices per course)...');
  const currentSemester = 'Fall 2026';
  const academicYear = '2026-2027';

  // Course CS-101 in Section CSE-A has TWO lecturer choices (Sarah Connor OR Alan Turing)
  const offering_CS101_A_Sarah = await prisma.courseOffering.create({
    data: { courseId: cs101.id, sectionId: secCS_A.id, lecturerId: lecturers[0].id, semester: currentSemester, academicYear, capacity: 30 }
  });
  const offering_CS101_A_Alan = await prisma.courseOffering.create({
    data: { courseId: cs101.id, sectionId: secCS_A.id, lecturerId: lecturers[2].id, semester: currentSemester, academicYear, capacity: 30 }
  });
  const offering_CS102_A_Grace = await prisma.courseOffering.create({
    data: { courseId: cs102.id, sectionId: secCS_A.id, lecturerId: lecturers[3].id, semester: currentSemester, academicYear, capacity: 35 }
  });
  const offering_CS103_A_Alan = await prisma.courseOffering.create({
    data: { courseId: cs103.id, sectionId: secCS_A.id, lecturerId: lecturers[2].id, semester: currentSemester, academicYear, capacity: 35 }
  });
  const offering_EE101_A_Charles = await prisma.courseOffering.create({
    data: { courseId: ee101.id, sectionId: secEE_A.id, lecturerId: lecturers[1].id, semester: currentSemester, academicYear, capacity: 40 }
  });

  console.log('Seeding timetables...');
  await prisma.timetable.createMany({
    data: [
      { courseOfferingId: offering_CS101_A_Sarah.id, dayOfWeek: 1, startTime: '09:00', endTime: '10:30', room: 'Lab 101' },
      { courseOfferingId: offering_CS101_A_Sarah.id, dayOfWeek: 3, startTime: '09:00', endTime: '10:30', room: 'Lab 101' },
      { courseOfferingId: offering_CS101_A_Alan.id, dayOfWeek: 1, startTime: '11:00', endTime: '12:30', room: 'Lab 102' },
      { courseOfferingId: offering_CS101_A_Alan.id, dayOfWeek: 3, startTime: '11:00', endTime: '12:30', room: 'Lab 102' },
      { courseOfferingId: offering_CS102_A_Grace.id, dayOfWeek: 2, startTime: '11:00', endTime: '12:30', room: 'Room 202' },
      { courseOfferingId: offering_CS102_A_Grace.id, dayOfWeek: 4, startTime: '11:00', endTime: '12:30', room: 'Room 202' },
      { courseOfferingId: offering_CS103_A_Alan.id, dayOfWeek: 1, startTime: '14:00', endTime: '15:30', room: 'Room 105' },
      { courseOfferingId: offering_CS103_A_Alan.id, dayOfWeek: 3, startTime: '14:00', endTime: '15:30', room: 'Room 105' },
      { courseOfferingId: offering_EE101_A_Charles.id, dayOfWeek: 2, startTime: '09:00', endTime: '10:30', room: 'Room 301' },
      { courseOfferingId: offering_EE101_A_Charles.id, dayOfWeek: 5, startTime: '09:00', endTime: '10:30', room: 'Room 301' },
    ],
  });

  console.log('Seeding 40 students...');
  const students = [];
  const firstNames = [
    'Emily', 'Jacob', 'Sophia', 'Matthew', 'Olivia', 'Ethan', 'Isabella', 'Alexander', 'Mia', 'William',
    'Charlotte', 'Michael', 'Amelia', 'Daniel', 'Harper', 'James', 'Evelyn', 'Benjamin', 'Abigail', 'Logan',
    'Emily', 'David', 'Elizabeth', 'Joseph', 'Sofia', 'Jackson', 'Avery', 'Samuel', 'Ella', 'Sebastian',
    'Madison', 'Dylan', 'Scarlett', 'Luke', 'Victoria', 'Henry', 'Aria', 'Gabriel', 'Grace', 'Carter'
  ];
  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
    'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'
  ];

  for (let i = 1; i <= 40; i++) {
    const firstName = firstNames[i - 1];
    const lastName = lastNames[i - 1];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@academix.edu`;
    const rollNo = `CS2026${String(i).padStart(3, '0')}`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'STUDENT',
      },
    });

    const isCS = i <= 30;
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        name: `${firstName} ${lastName}`,
        rollNumber: rollNo,
        email,
        phone: `+1 555-03${String(i).padStart(2, '0')}`,
        departmentId: isCS ? csDept.id : eeDept.id,
        programId: isCS ? (i <= 20 ? csBtech.id : csMtech.id) : eeBtech.id,
        sectionId: isCS ? (i <= 20 ? secCS_A.id : secCS_B.id) : secEE_A.id,
        admissionYear: 2026,
      },
    });
    students.push(student);

    // Enroll students into course offerings
    if (isCS && i <= 20) {
      await prisma.enrollment.create({
        data: { studentId: student.id, courseOfferingId: offering_CS101_A_Sarah.id, status: 'REGISTERED' },
      });
      await prisma.enrollment.create({
        data: { studentId: student.id, courseOfferingId: offering_CS102_A_Grace.id, status: 'REGISTERED' },
      });
      await prisma.enrollment.create({
        data: { studentId: student.id, courseOfferingId: offering_CS103_A_Alan.id, status: 'REGISTERED' },
      });
    } else if (!isCS) {
      await prisma.enrollment.create({
        data: { studentId: student.id, courseOfferingId: offering_EE101_A_Charles.id, status: 'REGISTERED' },
      });
    }

    // Seed Fees
    const tuitionFee = await prisma.fee.create({
      data: {
        studentId: student.id,
        title: 'Tuition Fee - Fall 2026',
        amount: 2500.0,
        dueDate: new Date('2026-09-30'),
        status: i % 4 === 0 ? 'UNPAID' : (i % 7 === 0 ? 'OVERDUE' : 'PAID'),
      },
    });

    if (tuitionFee.status === 'PAID') {
      await prisma.payment.create({
        data: {
          feeId: tuitionFee.id,
          amount: 2500.0,
          paymentDate: new Date('2026-07-20'),
          method: i % 2 === 0 ? 'CARD' : 'BANK_TRANSFER',
          transactionId: `TXN${Date.now()}${String(i).padStart(3, '0')}`,
        },
      });
    }
  }

  console.log('Seeding assignments and submissions...');
  const assignmentCS101 = await prisma.assignment.create({
    data: {
      courseOfferingId: offering_CS101_A_Sarah.id,
      title: 'Programming Assignment 1: Loops and Conditionals',
      description: 'Write a program in Node.js that checks for prime numbers and outputs Fibonacci series. Submit zip format.',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      maxPoints: 100,
    },
  });

  for (let i = 0; i < 10; i++) {
    const student = students[i];
    await prisma.submission.create({
      data: {
        assignmentId: assignmentCS101.id,
        studentId: student.id,
        submittedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        filePath: `/uploads/submissions/${student.id}_assign1.zip`,
        fileName: `${student.name.replace(/\s+/g, '')}_hw1.zip`,
        pointsObtained: i % 3 === 0 ? 95 : (i % 3 === 1 ? 88 : null),
        grade: i % 3 === 0 ? 'A' : (i % 3 === 1 ? 'B+' : null),
        feedback: i % 3 === 0 ? 'Excellent work, code is neat!' : (i % 3 === 1 ? 'Good job, but check corner cases.' : null),
        gradedById: lecturers[0].id,
        gradedAt: i % 3 !== 2 ? new Date() : null,
      },
    });
  }

  console.log('Seeding exams and grades...');
  const midsemExam = await prisma.exam.create({
    data: {
      courseOfferingId: offering_CS101_A_Sarah.id,
      title: 'Midterm Examination',
      date: new Date('2026-10-15T10:00:00Z'),
      maxPoints: 50,
      weight: 0.3,
    },
  });

  for (let i = 0; i < 15; i++) {
    const student = students[i];
    const score = 35 + (i % 15);
    let letter = 'A';
    if (score < 40) letter = 'B';
    if (score < 37) letter = 'C';
    await prisma.grade.create({
      data: {
        examId: midsemExam.id,
        studentId: student.id,
        pointsObtained: score,
        letterGrade: letter,
        gradedById: lecturers[0].id,
      },
    });
  }

  console.log('Seeding announcements...');
  await prisma.announcement.create({
    data: {
      title: 'Welcome to Academix SMS!',
      content: 'We are thrilled to launch the new Academix portal. Explore your courses, timetables, and fee details. Lecturers can now manage QR-based real-time attendance.',
      targetRole: 'ALL',
      createdById: adminUser.id,
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
