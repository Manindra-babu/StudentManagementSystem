import PDFDocument from 'pdfkit';
import { Response } from 'express';

export function generateFeeReceipt(res: Response, payment: any) {
  const doc = new PDFDocument({ margin: 50 });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=receipt_${payment.transactionId}.pdf`);
  
  doc.pipe(res);
  
  // Header
  doc.fontSize(20).text('ACADEMIX UNIVERSITY', { align: 'center' });
  doc.fontSize(10).text('OFFICIAL PAYMENT RECEIPT', { align: 'center' });
  doc.moveDown(2);
  
  // Content details
  doc.fontSize(12).text(`Transaction ID: ${payment.transactionId}`);
  doc.text(`Payment Date: ${new Date(payment.paymentDate).toLocaleDateString()}`);
  doc.text(`Payment Method: ${payment.method}`);
  doc.moveDown(1);
  
  doc.text(`Student: ${payment.fee.student.name} (${payment.fee.student.rollNumber})`);
  doc.text(`Department: ${payment.fee.student.department?.name || 'N/A'}`);
  doc.moveDown(1);
  
  doc.text('----------------------------------------------------');
  doc.fontSize(14).text(`Fee Title: ${payment.fee.title}`);
  doc.text(`Amount Paid: $${payment.amount.toFixed(2)}`);
  doc.fontSize(12).text('----------------------------------------------------');
  doc.moveDown(2);
  
  doc.fontSize(10).text('Thank you for your payment. This is a computer generated receipt.', { align: 'center', oblique: true });
  
  doc.end();
}

export function generateReportCard(res: Response, student: any, enrollments: any[], grades: any[]) {
  const doc = new PDFDocument({ margin: 50 });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=report_${student.rollNumber}.pdf`);
  
  doc.pipe(res);
  
  // Header
  doc.fontSize(20).text('ACADEMIX UNIVERSITY', { align: 'center' });
  doc.fontSize(10).text('ACADEMIC REPORT CARD', { align: 'center' });
  doc.moveDown(2);
  
  // Student Profile
  doc.fontSize(12).text(`Student Name: ${student.name}`);
  doc.text(`Roll Number: ${student.rollNumber}`);
  doc.text(`Program: ${student.program?.name || 'N/A'}`);
  doc.text(`Department: ${student.department?.name || 'N/A'}`);
  doc.moveDown(2);
  
  doc.fontSize(14).text('Academic Coursework & Performance:', { underline: true });
  doc.moveDown(1);
  
  if (enrollments.length === 0) {
    doc.fontSize(12).text('No course enrollments found for this student.');
  } else {
    enrollments.forEach((env) => {
      const courseGrades = grades.filter((g) => g.exam.classSectionId === env.classSectionId);
      
      doc.fontSize(12).text(`${env.classSection.course.name} (${env.classSection.course.code})`);
      doc.fontSize(10).text(`Instructor: ${env.classSection.lecturer.name}`);
      
      if (courseGrades.length > 0) {
        courseGrades.forEach((g) => {
          doc.fontSize(10).text(`  - ${g.exam.title}: ${g.pointsObtained}/${g.exam.maxPoints} points (Grade: ${g.letterGrade})`, { indent: 20 });
        });
      } else {
        doc.fontSize(10).text('  - No assessment records logged yet.', { indent: 20 });
      }
      doc.moveDown(1);
    });
  }
  
  doc.end();
}
