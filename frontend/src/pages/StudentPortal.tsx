import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { 
  Clock, BookOpen, FileText, AlertTriangle,
  QrCode, CreditCard, Download, LogOut, Award,
  Check, Sparkles, Send, Loader2, X
} from 'lucide-react';
import { ChatWidget } from '../components/ChatWidget';

const StudentPortal: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [registrationData, setRegistrationData] = useState<any>({ studentInfo: null, availableCourses: [] });
  const [selectedOfferings, setSelectedOfferings] = useState<{ [courseId: string]: string }>({});
  const [registerLoading, setRegisterLoading] = useState(false);

  // Scanner Simulator State
  const [checkinCode, setCheckinCode] = useState('');
  const [checkinLoading, setCheckinLoading] = useState(false);
  
  // Assignment Submission State
  const [submitForm, setSubmitForm] = useState({ assignmentId: '', fileName: 'solution_submission.zip' });
  const [submitLoading, setSubmitLoading] = useState(false);

  // Payments State
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const [resDash, resCourses, resAssigns, resGrades, resFees, resAtt, resReg] = await Promise.all([
        axios.get('/api/student/dashboard'),
        axios.get('/api/student/courses'),
        axios.get('/api/student/assignments'),
        axios.get('/api/student/grades'),
        axios.get('/api/student/fees'),
        axios.get('/api/student/attendance'),
        axios.get('/api/student/registration/offerings')
      ]);

      setDashboardData(resDash.data);
      setCourses(resCourses.data);
      setAssignments(resAssigns.data);
      setGrades(resGrades.data);
      setFees(resFees.data);
      setAttendance(resAtt.data);
      setRegistrationData(resReg.data);

      // Pre-select registered offerings
      const preSelected: { [key: string]: string } = {};
      if (resReg.data.availableCourses) {
        resReg.data.availableCourses.forEach((c: any) => {
          const regOff = c.offerings.find((o: any) => o.isRegistered);
          if (regOff) {
            preSelected[c.courseId] = regOff.id;
          } else if (c.offerings.length > 0) {
            preSelected[c.courseId] = c.offerings[0].id;
          }
        });
      }
      setSelectedOfferings(preSelected);
    } catch (err) {
      showToast('Failed to retrieve student profile datasets.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, []);

  const handleSelectOffering = (courseId: string, offeringId: string) => {
    setSelectedOfferings(prev => ({ ...prev, [courseId]: offeringId }));
  };

  const handleSubmitRegistration = async () => {
    const offeringIds = Object.values(selectedOfferings).filter(Boolean);
    if (offeringIds.length === 0) {
      showToast('Please select at least one course.', 'error');
      return;
    }
    setRegisterLoading(true);
    try {
      await axios.post('/api/student/registration/register', { offeringIds });
      showToast('Course registration submitted successfully!');
      fetchStudentData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Registration failed.', 'error');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleDropCourse = async (courseOfferingId: string) => {
    if (!window.confirm('Are you sure you want to drop this course?')) return;
    try {
      await axios.post('/api/student/registration/drop', { courseOfferingId });
      showToast('Course dropped.');
      fetchStudentData();
    } catch (err) {
      showToast('Failed to drop course.', 'error');
    }
  };

  // QR Attendance check-in submit
  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkinCode) return;
    setCheckinLoading(true);
    try {
      await axios.post('/api/attendance/checkin', { code: checkinCode });
      showToast('Attendance recorded! Real-time roster synced.');
      setCheckinCode('');
      fetchStudentData();
      setActiveTab('dashboard');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to check in. Verify code or expiry.', 'error');
    } finally {
      setCheckinLoading(false);
    }
  };

  // Submit Assignment solution
  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      await axios.post(`/api/student/assignments/${submitForm.assignmentId}/submit`, {
        fileName: submitForm.fileName
      });
      showToast('Assignment uploaded successfully!');
      setSubmitForm({ assignmentId: '', fileName: 'solution_submission.zip' });
      fetchStudentData();
    } catch (err) {
      showToast('Failed to upload submission.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Mock make payment
  const handlePayFee = async (feeId: string) => {
    setPaymentLoading(feeId);
    try {
      await axios.post(`/api/student/fees/${feeId}/pay`, { method: 'CARD' });
      showToast('Payment successful! Invoice cleared.');
      fetchStudentData();
    } catch (err) {
      showToast('Payment processing failed.', 'error');
    } finally {
      setPaymentLoading(null);
    }
  };

  // PDF Download Trigger
  const triggerPDFDownload = async (url: string, filename: string) => {
    try {
      const response = await axios.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      showToast('Report generation failed.', 'error');
    }
  };

  // Compile Calendar Heatmap values
  // We'll generate a grid of 28 blocks representing recent school days
  const renderHeatmap = () => {
    const blocks = [];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 27); // 28 days back

    for (let i = 0; i < 28; i++) {
      const cur = new Date(baseDate);
      cur.setDate(baseDate.getDate() + i);
      const isWeekend = cur.getDay() === 0 || cur.getDay() === 6;

      // Find record matching date
      const record = attendance.find(a => {
        const recordDate = new Date(a.markedAt);
        return recordDate.toDateString() === cur.toDateString();
      });

      let bgColor = 'bg-slate-100 hover:bg-slate-200';
      let titleText = `${cur.toLocaleDateString()}: No class scheduled`;

      if (isWeekend) {
        bgColor = 'bg-slate-50';
        titleText = `${cur.toLocaleDateString()}: Weekend`;
      } else if (record) {
        if (record.status === 'PRESENT') {
          bgColor = 'bg-emerald-500 hover:bg-emerald-600';
          titleText = `${cur.toLocaleDateString()}: PRESENT (${record.session?.courseOffering?.course?.code || record.session?.classSection?.course?.code || ''})`;
        } else if (record.status === 'LATE') {
          bgColor = 'bg-amber-400 hover:bg-amber-500';
          titleText = `${cur.toLocaleDateString()}: LATE (${record.session?.courseOffering?.course?.code || record.session?.classSection?.course?.code || ''})`;
        } else if (record.status === 'ABSENT') {
          bgColor = 'bg-rose-500 hover:bg-rose-600';
          titleText = `${cur.toLocaleDateString()}: ABSENT (${record.session?.courseOffering?.course?.code || record.session?.classSection?.course?.code || ''})`;
        }
      } else if (!isWeekend && cur < new Date()) {
        bgColor = 'bg-slate-200';
        titleText = `${cur.toLocaleDateString()}: Unscheduled or Absent`;
      }

      blocks.push(
        <div 
          key={i}
          className={`w-7 h-7 rounded-md smooth-hover cursor-pointer border border-white/40 shadow-sm ${bgColor}`}
          title={titleText}
        />
      );
    }
    return blocks;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {toast && (
        <div className={`fixed top-5 right-5 px-5 py-3 rounded-xl shadow-lg text-white font-medium text-sm transition-all z-50 ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-accent-500 flex items-center justify-center shadow-md">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 font-outfit text-md leading-none">Academix</h2>
            <span className="text-[10px] font-bold text-primary-600 uppercase tracking-widest mt-1 block font-sans">Student Desk</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'dashboard', label: 'My Dashboard', icon: Sparkles },
            { id: 'registration', label: 'Course Registration', icon: BookOpen },
            { id: 'checkin', label: 'QR Class Check-in', icon: QrCode },
            { id: 'courses', label: 'My Enrolled Courses', icon: BookOpen },
            { id: 'assignments', label: 'Assignments Desk', icon: FileText },
            { id: 'grades', label: 'Exams & Result Card', icon: Award },
            { id: 'fees', label: 'Billing Invoices', icon: CreditCard }
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 font-semibold text-sm smooth-hover cursor-pointer ${
                  activeTab === item.id 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${activeTab === item.id ? 'text-primary-600' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3 mb-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-xs">
              ST
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">{user?.profile?.name}</p>
              <span className="text-[9px] text-slate-400 font-medium truncate block">Roll: {user?.profile?.rollNumber}</span>
            </div>
          </div>

          <button 
            onClick={logout}
            className="w-full py-2.5 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-xl text-xs font-bold flex items-center justify-center gap-2 smooth-hover border border-transparent hover:border-rose-100 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 overflow-y-auto min-h-screen">
        <header className="h-16 bg-white border-b border-slate-100 px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-outfit text-slate-900 capitalize">
              {activeTab === 'registration' ? 'Semester Course Registration' : `${activeTab} Workspace`}
            </h1>
            <span className="px-3 py-1 bg-primary-50 border border-primary-100 text-primary-700 font-extrabold rounded-full text-xs flex items-center gap-1.5 shadow-sm">
              Dept: {user?.profile?.department?.name || 'CSE'} | Section: {user?.profile?.section?.name || 'CSE-A'}
            </span>
          </div>

          <div className="text-right">
            <p className="text-xs font-semibold text-slate-700">{user?.profile?.name}</p>
            <p className="text-[10px] text-slate-400">{user?.profile?.rollNumber}</p>
          </div>
        </header>

        <div className="p-8">
          {loading ? (
            <div className="h-[60vh] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
            <>
              {/* TAB 1: MY DASHBOARD */}
              {activeTab === 'dashboard' && dashboardData && (
                <div className="space-y-8">
                  {/* Stats & Heatmap row */}
                  <div className="grid grid-cols-3 gap-8">
                    {/* Circle attendance rate */}
                    <div className="glass-card rounded-2xl p-6 border border-slate-200/50 flex flex-col justify-between items-center text-center">
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">My Attendance Ratio</h4>
                      <div className="relative w-36 h-36 flex items-center justify-center mt-3">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="72" cy="72" r="62" stroke="#e2e8f0" strokeWidth="10" fill="transparent" />
                          <circle cx="72" cy="72" r="62" stroke="#8b5cf6" strokeWidth="10" fill="transparent" 
                            strokeDasharray={2 * Math.PI * 62} 
                            strokeDashoffset={2 * Math.PI * 62 * (1 - dashboardData.attendanceRate / 100)} 
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="text-2xl font-black text-slate-900">{dashboardData.attendanceRate}%</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Average</span>
                        </div>
                      </div>
                      
                      {dashboardData.attendanceRate < 75 && (
                        <div className="flex gap-1.5 items-center text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2 mt-4">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          Low Attendance Shortage! (Limit: 75%)
                        </div>
                      )}
                    </div>

                    {/* Attendance Heatmap */}
                    <div className="col-span-2 glass-card rounded-2xl p-6 border border-slate-200/50 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1">Attendance Tracker Calendar</h4>
                        <p className="text-[10px] text-slate-400 font-semibold mb-4">Color codes display classroom attendance logs over the past 4 weeks</p>
                      </div>
                      <div className="grid grid-cols-7 gap-2.5 w-fit">
                        {renderHeatmap()}
                      </div>
                      <div className="flex gap-4 text-[10px] font-bold text-slate-500 border-t border-slate-100 pt-3.5 mt-4">
                        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Present</div>
                        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-400" /> Late</div>
                        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500" /> Absent</div>
                        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-200" /> Free / Unscheduled</div>
                      </div>
                    </div>
                  </div>

                  {/* Class timetable and noticeboard */}
                  <div className="grid grid-cols-3 gap-8">
                    <div className="col-span-2 space-y-4">
                      <h4 className="font-bold text-slate-900 text-sm">Today's Class Timetable</h4>
                      {dashboardData.todayClasses.length === 0 ? (
                        <div className="glass-card rounded-2xl p-6 border border-dashed border-slate-200 text-center text-slate-400 text-sm">
                          No classes scheduled for today.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {dashboardData.todayClasses.map((cls: any, idx: number) => (
                            <div key={idx} className="glass-card rounded-2xl p-5 flex justify-between items-center border border-slate-200/50">
                              <div className="flex gap-4 items-center">
                                <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                                  <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                  <h5 className="font-bold text-slate-900 text-sm">{cls.courseName}</h5>
                                  <p className="text-xs text-slate-500 mt-0.5">{cls.courseCode} • {cls.sectionName}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                                  {cls.startTime} - {cls.endTime}
                                </span>
                                <p className="text-[10px] text-slate-400 mt-1.5 font-medium">Room: {cls.room}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-900 text-sm">Announcements Board</h4>
                      <div className="space-y-3.5">
                        {dashboardData.announcements.map((ann: any) => (
                          <div key={ann.id} className="glass-card rounded-xl p-4 border border-slate-200/50 bg-slate-50/20">
                            <h5 className="font-bold text-slate-800 text-xs">{ann.title}</h5>
                            <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">{ann.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: COURSE REGISTRATION */}
              {activeTab === 'registration' && (
                <div className="space-y-8">
                  {/* Department & Section Banner */}
                  <div className="bg-gradient-to-r from-primary-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary-200 block mb-1">
                        Academic Year 2026-2027 • Fall Semester
                      </span>
                      <h2 className="text-xl font-bold font-outfit">Semester Course Registration Desk</h2>
                      <p className="text-xs text-primary-100 mt-1">
                        Department: <span className="font-bold text-white">{registrationData.studentInfo?.departmentName || 'Computer Science & Engineering'}</span> | 
                        Assigned Section: <span className="font-bold text-white">{registrationData.studentInfo?.sectionName || 'CSE-A'}</span>
                      </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/20 text-right">
                      <p className="text-xs font-medium text-primary-100">Student Roll No</p>
                      <p className="text-sm font-bold">{registrationData.studentInfo?.rollNumber || user?.profile?.rollNumber}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-8">
                    {/* Courses offering cards */}
                    <div className="col-span-2 space-y-6">
                      <h3 className="font-bold text-slate-900 text-base">Available Department Courses</h3>
                      
                      {registrationData.availableCourses?.length === 0 ? (
                        <div className="glass-card rounded-2xl p-8 text-center text-slate-500 text-sm">
                          No course offerings available for your section at this time.
                        </div>
                      ) : (
                        registrationData.availableCourses?.map((course: any) => {
                          const selectedOffId = selectedOfferings[course.courseId];
                          return (
                            <div key={course.courseId} className="glass-card rounded-2xl p-6 border border-slate-200/50 shadow-sm space-y-4">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                  <h4 className="font-bold text-slate-900 text-base">{course.courseName}</h4>
                                  <span className="text-xs font-semibold text-primary-600">{course.courseCode}</span>
                                </div>
                                <span className="px-3 py-1 bg-slate-100 text-slate-700 font-bold text-xs rounded-full">
                                  {course.creditHours} Credit Hours
                                </span>
                              </div>

                              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Preferred Instructor / Lecturer Choice:</p>
                              
                              <div className="space-y-3">
                                {course.offerings.map((off: any) => {
                                  const isSelected = selectedOffId === off.id;
                                  const isFull = off.seatsLeft === 0 && !off.isRegistered;
                                  return (
                                    <div 
                                      key={off.id}
                                      onClick={() => !isFull && handleSelectOffering(course.courseId, off.id)}
                                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                        isSelected 
                                          ? 'border-primary-500 bg-primary-50/60 ring-2 ring-primary-500/20' 
                                          : (isFull ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed' : 'border-slate-200 hover:border-slate-300 bg-white')
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                          isSelected ? 'border-primary-600 bg-primary-600' : 'border-slate-300'
                                        }`}>
                                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                        <div>
                                          <p className="text-sm font-bold text-slate-900">{off.lecturerName}</p>
                                          <span className="text-[11px] text-slate-500 font-medium">Emp ID: {off.employeeId}</span>
                                        </div>
                                      </div>

                                      <div className="text-right">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                          isFull ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'
                                        }`}>
                                          {off.enrolledCount} / {off.capacity} Enrolled ({off.seatsLeft} left)
                                        </span>
                                        {off.isRegistered && (
                                          <span className="ml-2 px-2 py-0.5 bg-primary-600 text-white rounded text-[10px] font-bold">
                                            Currently Registered
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Registration Summary & Actions Panel */}
                    <div className="space-y-6">
                      <div className="glass-card rounded-2xl p-6 border border-slate-200/50 space-y-4">
                        <h4 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">Registration Summary</h4>
                        
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-500">Selected Courses</span>
                            <span className="font-bold text-slate-900">{Object.keys(selectedOfferings).length} Courses</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-500">Target Semester</span>
                            <span className="font-bold text-slate-900">Fall 2026</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-500">Status</span>
                            <span className="font-bold text-emerald-600">Registration Open</span>
                          </div>
                        </div>

                        <button
                          onClick={handleSubmitRegistration}
                          disabled={registerLoading}
                          className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-sm smooth-hover shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {registerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Confirm & Register Courses
                        </button>
                      </div>

                      {/* Registered Courses list */}
                      <div className="glass-card rounded-2xl p-6 border border-slate-200/50 space-y-3">
                        <h4 className="font-bold text-slate-900 text-sm">Enrolled Courses (Active)</h4>
                        {courses.length === 0 ? (
                          <p className="text-xs text-slate-400">No active registrations yet.</p>
                        ) : (
                          courses.map(env => (
                            <div key={env.id} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-100">
                              <div>
                                <p className="font-bold text-slate-900">{env.courseOffering?.course?.name}</p>
                                <p className="text-[10px] text-slate-500">{env.courseOffering?.lecturer?.name}</p>
                              </div>
                              <button
                                onClick={() => handleDropCourse(env.courseOfferingId)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-bold text-[10px] smooth-hover cursor-pointer"
                              >
                                Drop
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: QR CHECK-IN CAMERA SIMULATOR */}
              {activeTab === 'checkin' && (
                <div className="max-w-xl mx-auto space-y-6">
                  {/* Mock scanner panel */}
                  <div className="glass-card rounded-2xl p-8 border border-slate-200/50 shadow flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mb-3 shadow-sm shadow-primary-100">
                      <QrCode className="w-6 h-6 animate-pulse" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">QR Code Attendance Scanner</h3>
                    <p className="text-xs text-slate-400 mt-1 text-center">
                      Point camera at the lecturer's screen QR Code or enter the session code manually below.
                    </p>

                    {/* Camera simulated block */}
                    <div className="w-full max-w-sm aspect-video bg-slate-900 rounded-2xl my-6 relative overflow-hidden flex flex-col items-center justify-center border border-slate-800 shadow-inner">
                      {/* Green scanning bounding box */}
                      <div className="w-36 h-36 border-2 border-dashed border-emerald-400 rounded-lg flex items-center justify-center relative">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-500 -mt-0.5 -ml-0.5" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-500 -mt-0.5 -mr-0.5" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-500 -mb-0.5 -ml-0.5" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-500 -mb-0.5 -mr-0.5" />
                        
                        {/* Red scanning line */}
                        <div className="w-full h-0.5 bg-rose-500/80 absolute top-1/2 left-0 animate-bounce" />
                      </div>
                      
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest absolute bottom-4">
                        Scanning Camera Interface Active
                      </span>
                    </div>

                    <form onSubmit={handleCheckin} className="w-full max-w-sm space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Enter QR Code Contents</label>
                        <input
                          type="text"
                          value={checkinCode}
                          onChange={e => setCheckinCode(e.target.value)}
                          placeholder="e.g. F0W9P2-4091"
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white uppercase font-bold text-center tracking-wider text-slate-800"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={checkinLoading}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-100 smooth-hover cursor-pointer"
                      >
                        {checkinLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Submit Check-in
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB: ENROLLED COURSES */}
              {activeTab === 'courses' && (
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Enrolled Course Curriculum</h3>
                      <p className="text-xs text-slate-400">View active class sections, credit allocations, and course materials</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {courses.length === 0 ? (
                      <div className="col-span-2 glass-card p-8 rounded-2xl text-center text-slate-400 text-sm">
                        No active course enrollments found.
                      </div>
                    ) : (
                      courses.map((env: any) => (
                        <div key={env.id} className="glass-card rounded-2xl p-5 border border-slate-200/50 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="px-2.5 py-0.5 rounded-md bg-primary-50 text-primary-700 font-extrabold text-[10px] uppercase">
                                {env.courseOffering?.course?.code || env.classSection?.course?.code}
                              </span>
                              <h4 className="font-bold text-slate-900 text-sm mt-1.5">
                                {env.courseOffering?.course?.name || env.classSection?.course?.name}
                              </h4>
                            </div>
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              {env.courseOffering?.course?.creditHours || env.classSection?.course?.creditHours} Credits
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-100">
                            <p className="font-medium">
                              <span className="font-bold text-slate-700">Section:</span> {env.courseOffering?.section?.name || env.classSection?.name} ({env.courseOffering?.semester || env.classSection?.semester})
                            </p>
                            <p className="font-medium">
                              <span className="font-bold text-slate-700">Lecturer:</span> {env.courseOffering?.lecturer?.name || env.classSection?.lecturer?.name || 'TBD'}
                            </p>
                          </div>

                          <div className="pt-2 flex justify-end">
                            <button
                              onClick={() => showToast('Course materials syllabus downloaded.')}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 smooth-hover cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Syllabus PDF
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: ASSIGNMENTS DESK */}
              {activeTab === 'assignments' && (
                <div className="grid grid-cols-3 gap-8">
                  {/* Assignment table */}
                  <div className="col-span-2 space-y-4">
                    <div className="glass-card rounded-2xl border border-slate-200/50 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="px-6 py-3.5">Homework Assignment</th>
                            <th className="px-6 py-3.5">Course Code</th>
                            <th className="px-6 py-3.5 text-center">Due Date</th>
                            <th className="px-6 py-3.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {assignments.map(assign => {
                            const sub = assign.submissions?.[0];
                            return (
                              <tr key={assign.id} className="hover:bg-slate-50/50 smooth-hover">
                                <td className="px-6 py-3.5 font-bold text-slate-800">
                                  <div>{assign.title}</div>
                                  <div className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-normal max-w-sm truncate" title={assign.description}>
                                    {assign.description}
                                  </div>
                                </td>
                                <td className="px-6 py-3.5 font-semibold text-slate-500 text-xs">
                                  {assign.courseOffering?.course?.code || assign.classSection?.course?.code}
                                </td>
                                <td className="px-6 py-3.5 text-center text-xs font-semibold text-slate-400">
                                  {new Date(assign.dueDate).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-3.5 text-right">
                                  {sub ? (
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                      sub.pointsObtained !== null ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                      {sub.pointsObtained !== null ? `Graded: ${sub.grade}` : 'Submitted'}
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => setSubmitForm({ ...submitForm, assignmentId: assign.id })}
                                      className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded text-xs font-bold smooth-hover cursor-pointer"
                                    >
                                      Submit File
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Submission form panel */}
                  <div>
                    {submitForm.assignmentId && (
                      <div className="glass-card rounded-2xl p-6 border border-slate-200/50 sticky top-24">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                          <h4 className="font-bold text-slate-900 text-sm">Upload Submission</h4>
                          <button onClick={() => setSubmitForm({ ...submitForm, assignmentId: '' })} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <form onSubmit={handleSubmitAssignment} className="space-y-4 text-xs font-semibold text-slate-500">
                          <div>
                            <label className="block mb-1">Submission File Name</label>
                            <input
                              type="text"
                              value={submitForm.fileName}
                              onChange={e => setSubmitForm({ ...submitForm, fileName: e.target.value })}
                              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                              placeholder="e.g. homework_sol.zip"
                              required
                            />
                          </div>

                          <div className="border border-dashed border-slate-200 p-5 rounded-xl text-center text-slate-400 flex flex-col items-center">
                            <Send className="w-6 h-6 text-slate-300 mb-1" />
                            <p className="text-[10px]">Solutions are processed securely.</p>
                            <span className="text-[8px] text-slate-300 block mt-1">Accept ZIP, PDF, or DOCX formats</span>
                          </div>

                          <button
                            type="submit"
                            disabled={submitLoading}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs smooth-hover cursor-pointer"
                          >
                            {submitLoading ? 'Uploading...' : 'Submit Assignment'}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: EXAMS & RESULTS CARD */}
              {activeTab === 'grades' && (
                <div className="max-w-3xl mx-auto space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-900 text-sm">Academic Result Sheets</h4>
                    <button
                      onClick={() => triggerPDFDownload('/api/student/grades/report-card', `report_${user?.profile?.rollNumber}.pdf`)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 smooth-hover shadow cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Download Report Card PDF
                    </button>
                  </div>

                  <div className="glass-card rounded-2xl border border-slate-200/50 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          <th className="px-6 py-3.5">Subject</th>
                          <th className="px-6 py-3.5">Evaluation</th>
                          <th className="px-6 py-3.5 text-center">Score Obtained</th>
                          <th className="px-6 py-3.5 text-right">Letter Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {grades.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-xs">
                              No examination grades recorded.
                            </td>
                          </tr>
                        ) : (
                          grades.map(grade => (
                            <tr key={grade.id} className="hover:bg-slate-50/50 smooth-hover">
                              <td className="px-6 py-3.5 font-bold text-slate-800">{grade.exam.classSection.course.name}</td>
                              <td className="px-6 py-3.5 text-xs text-slate-500">{grade.exam.title}</td>
                              <td className="px-6 py-3.5 text-center font-semibold text-slate-600">
                                {grade.pointsObtained} / {grade.exam.maxPoints}
                              </td>
                              <td className="px-6 py-3.5 text-right font-black text-primary-700">{grade.letterGrade}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: BILLING INVOICES */}
              {activeTab === 'fees' && (
                <div className="max-w-3xl mx-auto space-y-4">
                  <div className="glass-card rounded-2xl border border-slate-200/50 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          <th className="px-6 py-3.5">Invoice Item</th>
                          <th className="px-6 py-3.5">Billing Amount</th>
                          <th className="px-6 py-3.5 text-center">Dues Date</th>
                          <th className="px-6 py-3.5 text-center">Status</th>
                          <th className="px-6 py-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {fees.map(fee => {
                          const payment = fee.payments?.[0];
                          return (
                            <tr key={fee.id} className="hover:bg-slate-50/50 smooth-hover">
                              <td className="px-6 py-3.5 font-bold text-slate-800">{fee.title}</td>
                              <td className="px-6 py-3.5 font-semibold text-slate-600">${fee.amount.toFixed(2)}</td>
                              <td className="px-6 py-3.5 text-center text-xs text-slate-400 font-semibold">
                                {new Date(fee.dueDate).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-3.5 text-center">
                                <span className={`px-2.5 py-1 rounded-full font-bold text-[9px] uppercase ${
                                  fee.status === 'PAID' 
                                    ? 'bg-emerald-50 text-emerald-700' 
                                    : (fee.status === 'OVERDUE' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700')
                                }`}>
                                  {fee.status}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                {fee.status === 'PAID' ? (
                                  payment && (
                                    <button
                                      onClick={() => triggerPDFDownload(`/api/student/payments/${payment.id}/receipt`, `receipt_${payment.transactionId}.pdf`)}
                                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1 smooth-hover cursor-pointer"
                                      title="Download Receipt"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      Receipt
                                    </button>
                                  )
                                ) : (
                                  <button
                                    onClick={() => handlePayFee(fee.id)}
                                    disabled={paymentLoading === fee.id}
                                    className="px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 smooth-hover shadow shadow-primary-100 cursor-pointer"
                                  >
                                    <CreditCard className="w-3.5 h-3.5" />
                                    Pay Now
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Floating AI Chat Assistant Widget */}
      <ChatWidget onNavigate={(tab) => setActiveTab(tab)} />
    </div>
  );
};

export default StudentPortal;
