import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import axios from 'axios';
import { 
  Clock, Award, BookOpen, Check, X,
  QrCode, ChevronRight, FileEdit, Plus,
  LogOut, CheckSquare
} from 'lucide-react';
import { ChatWidget } from '../components/ChatWidget';
import { Logo } from '../components/Logo';

const LecturerPortal: React.FC = () => {
  const { user, logout } = useAuth();
  const socket = useSocket();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);

  // Real-time Attendance Session State
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [activeSession, setActiveSession] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [minutesValid, setMinutesValid] = useState('10');
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Form states
  const [assignmentForm, setAssignmentForm] = useState({ courseOfferingId: '', title: '', description: '', dueDate: '', maxPoints: '100' });
  const [examForm, setExamForm] = useState({ courseOfferingId: '', title: '', date: '', maxPoints: '100', weight: '0.3' });
  
  // Submission Grading states
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [gradeForm, setGradeForm] = useState({ submissionId: '', pointsObtained: '', grade: 'A', feedback: '' });

  // Exam Grading states
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examGrades, setExamGrades] = useState<any[]>([]);
  const [examGradeForm, setExamGradeForm] = useState({ studentId: '', pointsObtained: '', letterGrade: 'A' });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchBaseData = async () => {
    setLoading(true);
    try {
      const [resDash, resSecs, resAssigns, resExams] = await Promise.all([
        axios.get('/api/lecturer/dashboard'),
        axios.get('/api/lecturer/sections'),
        axios.get('/api/lecturer/assignments'),
        axios.get('/api/lecturer/exams')
      ]);
      setDashboardData(resDash.data);
      setSections(resSecs.data);
      setAssignments(resAssigns.data);
      setExams(resExams.data);

      if (resSecs.data.length > 0 && !selectedSectionId) {
        setSelectedSectionId(resSecs.data[0].id);
      }
    } catch (err) {
      showToast('Failed to retrieve lecturer dataset.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBaseData();
  }, []);

  // WebSockets integration for real-time check-ins
  useEffect(() => {
    if (!socket || !activeSession) return;

    // Join room for active session
    socket.emit('joinSession', activeSession.id);

    // Live QR Check-in listeners
    socket.on('studentCheckedIn', (data: any) => {
      setRoster(prevRoster => {
        const studentIndex = prevRoster.findIndex(r => r.studentId === data.studentId);
        if (studentIndex > -1) {
          const updated = [...prevRoster];
          updated[studentIndex] = { ...updated[studentIndex], ...data };
          return updated;
        }
        return [...prevRoster, data];
      });
      showToast(`${data.name} checked in via QR!`);
    });

    socket.on('rosterUpdated', (data: any) => {
      setRoster(prevRoster => {
        const studentIndex = prevRoster.findIndex(r => r.studentId === data.studentId);
        if (studentIndex > -1) {
          const updated = [...prevRoster];
          updated[studentIndex] = { ...updated[studentIndex], ...data };
          return updated;
        }
        return [...prevRoster, data];
      });
    });

    socket.on('sessionFinalized', () => {
      setActiveSession((prev: any) => prev ? { ...prev, status: 'COMPLETED' } : null);
      showToast('Session finalized.');
    });

    return () => {
      socket.emit('leaveSession', activeSession.id);
      socket.off('studentCheckedIn');
      socket.off('rosterUpdated');
      socket.off('sessionFinalized');
    };
  }, [socket, activeSession]);

  // Attendance controls
  const handleStartSession = async () => {
    if (!selectedSectionId) return;
    setAttendanceLoading(true);
    try {
      const res = await axios.post('/api/attendance/session', {
        courseOfferingId: selectedSectionId,
        minutesValid: parseInt(minutesValid)
      });
      setActiveSession(res.data);
      showToast('Live attendance QR code generated!');
      
      // Load roster
      const rosterRes = await axios.get(`/api/attendance/session/${res.data.id}/roster`);
      setRoster(rosterRes.data.roster);
      setActiveTab('attendance-active');
    } catch (err) {
      showToast('Failed to start session.', 'error');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleManualOverride = async (studentId: string, status: string) => {
    if (!activeSession) return;
    try {
      await axios.post(`/api/attendance/session/${activeSession.id}/override`, {
        studentId,
        status,
        reason: 'Instructor override'
      });
      showToast('Roster updated.');
    } catch (err) {
      showToast('Override failed.', 'error');
    }
  };

  const handleMarkAllPresent = async () => {
    if (!activeSession) return;
    try {
      await axios.post(`/api/attendance/session/${activeSession.id}/mark-all`, {
        status: 'PRESENT',
        reason: 'Lecturer marked all present'
      });
      setRoster(prevRoster => prevRoster.map(row => ({
        ...row,
        status: 'PRESENT',
        markedMethod: 'MANUAL'
      })));
      showToast('All students marked PRESENT! Toggle absent students using the red X.');
    } catch (err) {
      showToast('Mark all present failed.', 'error');
    }
  };

  const handleFinalizeSession = async () => {
    if (!activeSession) return;
    if (!window.confirm('Finalize attendance? Unmarked students will be set to ABSENT.')) return;
    try {
      await axios.post(`/api/attendance/session/${activeSession.id}/finalize`);
      showToast('Attendance record saved.');
      fetchBaseData();
      setActiveTab('dashboard');
      setActiveSession(null);
    } catch (err) {
      showToast('Finalize failed.', 'error');
    }
  };

  // Grade Assignment Submissions
  const handleLoadSubmissions = async (assignId: string) => {
    setSelectedAssignmentId(assignId);
    try {
      const res = await axios.get(`/api/lecturer/assignments/${assignId}/submissions`);
      setSubmissions(res.data.submissions);
    } catch (err) {
      showToast('Failed to load submissions.', 'error');
    }
  };

  const handleGradeSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { submissionId, pointsObtained, grade, feedback } = gradeForm;
      await axios.post(`/api/lecturer/submissions/${submissionId}/grade`, {
        pointsObtained: parseFloat(pointsObtained),
        grade,
        feedback
      });
      showToast('Grade submitted!');
      setGradeForm({ submissionId: '', pointsObtained: '', grade: 'A', feedback: '' });
      handleLoadSubmissions(selectedAssignmentId);
      fetchBaseData();
    } catch (err) {
      showToast('Failed to submit grade.', 'error');
    }
  };

  // Create Assignment
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/lecturer/assignments', assignmentForm);
      showToast('Assignment created.');
      setAssignmentForm({ courseOfferingId: '', title: '', description: '', dueDate: '', maxPoints: '100' });
      fetchBaseData();
    } catch (err) {
      showToast('Failed to create assignment.', 'error');
    }
  };

  // Create Exam
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/lecturer/exams', examForm);
      showToast('Exam created successfully.');
      setExamForm({ courseOfferingId: '', title: '', date: '', maxPoints: '100', weight: '0.3' });
      fetchBaseData();
    } catch (err) {
      showToast('Failed to create exam.', 'error');
    }
  };

  // Grade Exam
  const handleLoadExamGrades = async (examId: string) => {
    setSelectedExamId(examId);
    try {
      const examObj = exams.find(e => e.id === examId);
      if (!examObj) return;

      const deptId = examObj.courseOffering?.course?.departmentId || examObj.classSection?.course?.departmentId;
      const classRes = await axios.get(`/api/admin/students`);
      const studentsInClass = classRes.data.filter((s: any) => !deptId || s.departmentId === deptId);
      
      setExamGrades(studentsInClass);
    } catch (err) {
      showToast('Failed to load class roster for exam.', 'error');
    }
  };

  const handleGradeExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { studentId, pointsObtained, letterGrade } = examGradeForm;
      await axios.post(`/api/lecturer/exams/${selectedExamId}/grade`, {
        studentId,
        pointsObtained: parseFloat(pointsObtained),
        letterGrade
      });
      showToast('Grade recorded!');
      setExamGradeForm({ studentId: '', pointsObtained: '', letterGrade: 'A' });
      fetchBaseData();
    } catch (err) {
      showToast('Failed to record grade.', 'error');
    }
  };

  const activeCheckinCount = roster.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;

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
        <div className="p-5 border-b border-slate-100">
          <Logo size={38} />
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'dashboard', label: 'Faculty Dashboard', icon: BookOpen },
            { id: 'attendance', label: 'QR Check-in Console', icon: QrCode },
            { id: 'assignments', label: 'Course Assignments', icon: FileEdit },
            { id: 'exams', label: 'Examinations Desk', icon: Award }
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'attendance' && activeSession) {
                    setActiveTab('attendance-active');
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 font-semibold text-sm smooth-hover cursor-pointer ${
                  activeTab.startsWith(item.id)
                    ? 'bg-primary-50 text-primary-700' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${activeTab.startsWith(item.id) ? 'text-primary-600' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3 mb-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-xs">
              LC
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">{user?.profile?.name}</p>
              <span className="text-[9px] text-slate-400 font-medium truncate block">{user?.profile?.department?.name || 'Faculty Member'}</span>
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
          <h1 className="text-xl font-bold font-outfit text-slate-900 capitalize">
            {activeTab === 'attendance-active' ? 'Live QR Check-in Session' : `${activeTab} Panel`}
          </h1>
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-xs font-semibold text-slate-700">{user?.profile?.name}</p>
              <p className="text-[10px] text-slate-400">ID: {user?.profile?.employeeId}</p>
            </div>
          </div>
        </header>

        <div className="p-8">
          {loading ? (
            <div className="h-[60vh] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
            <>
              {/* TAB 1: FACULTY DASHBOARD */}
              {activeTab === 'dashboard' && dashboardData && (
                <div className="space-y-8">
                  {/* Dashboard Cards */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="glass-card rounded-2xl p-6">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Today's Class Slots</p>
                      <h3 className="text-2xl font-black text-slate-900">{dashboardData.todayClasses.length}</h3>
                    </div>
                    <div className="glass-card rounded-2xl p-6">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Gradings Pending</p>
                      <h3 className="text-2xl font-black text-amber-600">{dashboardData.pendingGradingCount}</h3>
                    </div>
                    <div className="glass-card rounded-2xl p-6">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Assigned Classes</p>
                      <h3 className="text-2xl font-black text-slate-900">{sections.length}</h3>
                    </div>
                  </div>

                  {/* Today Schedule & Upcoming exams */}
                  <div className="grid grid-cols-3 gap-8">
                    <div className="col-span-2 space-y-4">
                      <h4 className="font-bold text-slate-900 text-sm">Today's Class Timetable</h4>
                      {dashboardData.todayClasses.length === 0 ? (
                        <div className="glass-card rounded-2xl p-6 border border-dashed border-slate-200 text-center text-slate-400 text-sm">
                          No classes scheduled for today.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {dashboardData.todayClasses.map((cls: any, i: number) => (
                            <div key={i} className="glass-card rounded-2xl p-6 flex justify-between items-center border border-slate-200/50">
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
                      <h4 className="font-bold text-slate-900 text-sm">Upcoming Examinations</h4>
                      {dashboardData.upcomingExams.length === 0 ? (
                        <div className="glass-card rounded-2xl p-6 border border-dashed border-slate-200 text-center text-slate-400 text-sm">
                          No upcoming exams.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {dashboardData.upcomingExams.map((ex: any) => (
                            <div key={ex.id} className="glass-card rounded-xl p-4 border border-slate-200/50">
                              <p className="text-xs font-bold text-slate-800 leading-snug">{ex.title}</p>
                              <div className="flex justify-between items-center mt-2.5 text-[10px] font-semibold text-slate-400">
                                <span>{ex.courseCode} ({ex.sectionName})</span>
                                <span>{new Date(ex.date).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: QR CHECK-IN CONSOLE */}
              {activeTab === 'attendance' && (
                <div className="max-w-xl mx-auto glass-card rounded-2xl p-8 border border-slate-200/50 shadow-md">
                  <div className="flex flex-col items-center mb-6">
                    <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mb-2 shadow-sm shadow-primary-100">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Initiate Attendance Check-in</h3>
                    <p className="text-xs text-slate-400 mt-1">Generate a dynamic QR Code for student scanning</p>
                  </div>

                  <div className="space-y-5 text-xs font-semibold text-slate-500">
                    <div>
                      <label className="block mb-1">Select Class Section</label>
                      <select
                        value={selectedSectionId}
                        onChange={e => setSelectedSectionId(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 bg-white rounded-xl text-xs text-slate-800"
                      >
                        {sections.map(s => (
                          <option key={s.id} value={s.id}>
                            [{s.section?.department?.code || 'CSE'} - {s.section?.name}] {s.course.name} ({s.course.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block mb-1">Validity Limit (Minutes)</label>
                      <select
                        value={minutesValid}
                        onChange={e => setMinutesValid(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 bg-white rounded-xl text-xs text-slate-800"
                      >
                        <option value="5">5 Minutes</option>
                        <option value="10">10 Minutes</option>
                        <option value="15">15 Minutes</option>
                        <option value="20">20 Minutes</option>
                      </select>
                    </div>

                    <button
                      onClick={handleStartSession}
                      disabled={attendanceLoading}
                      className="w-full mt-2 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-primary-200 smooth-hover cursor-pointer"
                    >
                      <QrCode className="w-4 h-4" />
                      Generate Live QR Code
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2-ACTIVE: LIVE QR QR-CODE & ROSTER */}
              {activeTab === 'attendance-active' && activeSession && (
                <div className="grid grid-cols-3 gap-8">
                  {/* Left QR Screen */}
                  <div className="glass-card rounded-2xl p-6 border border-slate-200/50 flex flex-col items-center h-fit text-center">
                    <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-bold text-[9px] uppercase tracking-wider mb-2 animate-pulse">
                      Live Attendance Session
                    </span>
                    <h4 className="font-bold text-slate-800 text-sm">Scan QR to Register</h4>
                    
                    {/* Render Real QR Code */}
                    <div className="w-56 h-56 border border-slate-100 rounded-2xl p-3 bg-white mt-4 flex items-center justify-center shadow-inner qr-pulse-ring">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(activeSession.code)}`}
                        alt="Attendance QR Code"
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="mt-4 bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl text-xs font-bold text-slate-500">
                      Code: <span className="text-primary-700 font-black text-sm tracking-wider">{activeSession.code}</span>
                    </div>

                    <div className="mt-4 text-xs font-semibold text-slate-400">
                      Session expires at: {new Date(activeSession.expiresAt).toLocaleTimeString()}
                    </div>

                    <button
                      onClick={handleFinalizeSession}
                      className="w-full mt-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow smooth-hover cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Finalize Attendance
                    </button>
                  </div>

                  {/* Right Live Checked In Roster */}
                  <div className="col-span-2 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Checked In Students Roster</h4>
                        <p className="text-[10px] text-slate-400 font-medium">Click Mark All Present then toggle any absent student with red X</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleMarkAllPresent}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm border border-emerald-200/60 cursor-pointer"
                          title="Mark all roster students present"
                        >
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                          Mark All Present
                        </button>
                        <span className="px-3 py-1.5 bg-primary-100 text-primary-800 font-bold rounded-xl text-xs">
                          Present: {activeCheckinCount} / {roster.length}
                        </span>
                      </div>
                    </div>

                    <div className="glass-card rounded-2xl border border-slate-200/50 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="px-5 py-3">Roll No</th>
                            <th className="px-5 py-3">Name</th>
                            <th className="px-5 py-3 text-center">Method</th>
                            <th className="px-5 py-3 text-center">Status</th>
                            <th className="px-5 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {roster.map((row) => (
                            <tr key={row.studentId} className="hover:bg-slate-50/50 smooth-hover">
                              <td className="px-5 py-3 font-bold text-slate-900">{row.rollNumber}</td>
                              <td className="px-5 py-3 font-medium text-slate-700">{row.name}</td>
                              <td className="px-5 py-3 text-center font-semibold text-slate-400">
                                {row.markedMethod ? (
                                  <span className={`px-2 py-0.5 rounded text-[9px] uppercase ${row.markedMethod === 'QR' ? 'bg-primary-50 text-primary-600' : 'bg-amber-50 text-amber-600'}`}>
                                    {row.markedMethod}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-5 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                                  row.status === 'PRESENT' 
                                    ? 'bg-emerald-50 text-emerald-700' 
                                    : (row.status === 'ABSENT' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700')
                                }`}>
                                  {row.status}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right flex gap-1.5 justify-end">
                                <button
                                  onClick={() => handleManualOverride(row.studentId, 'PRESENT')}
                                  className="p-1 hover:bg-emerald-50 text-emerald-600 rounded smooth-hover cursor-pointer"
                                  title="Mark Present"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleManualOverride(row.studentId, 'ABSENT')}
                                  className="p-1 hover:bg-rose-50 text-rose-600 rounded smooth-hover cursor-pointer"
                                  title="Mark Absent"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleManualOverride(row.studentId, 'LATE')}
                                  className="px-1.5 py-0.5 hover:bg-amber-50 text-amber-600 font-bold rounded smooth-hover text-[9px] cursor-pointer"
                                  title="Mark Late"
                                >
                                  LATE
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: COURSE ASSIGNMENTS */}
              {activeTab === 'assignments' && (
                <div className="grid grid-cols-3 gap-8">
                  {/* Left list and grading console */}
                  <div className="col-span-2 space-y-6">
                    <div className="glass-card rounded-2xl border border-slate-200/50 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="px-6 py-3.5">Assignment</th>
                            <th className="px-6 py-3.5">Course</th>
                            <th className="px-6 py-3.5 text-center">Due Date</th>
                            <th className="px-6 py-3.5 text-right">Submissions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {assignments.map(assign => (
                            <tr 
                              key={assign.id} 
                              onClick={() => handleLoadSubmissions(assign.id)}
                              className={`hover:bg-slate-50/50 smooth-hover cursor-pointer ${selectedAssignmentId === assign.id ? 'bg-primary-50/30' : ''}`}
                            >
                              <td className="px-6 py-3.5 font-bold text-slate-800">{assign.title}</td>
                              <td className="px-6 py-3.5 text-xs text-slate-500">
                                {assign.courseOffering?.course?.name || assign.classSection?.course?.name || 'N/A'}
                              </td>
                              <td className="px-6 py-3.5 text-center text-xs font-semibold text-slate-400">
                                {new Date(assign.dueDate).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-3.5 text-right font-bold text-primary-700">
                                Review Submissions
                                <ChevronRight className="w-4 h-4 inline-block ml-1" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Submissions list panel */}
                    {selectedAssignmentId && (
                      <div className="space-y-4">
                        <h4 className="font-bold text-slate-900 text-sm">Student Submissions</h4>
                        {submissions.length === 0 ? (
                          <div className="glass-card rounded-2xl p-6 border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                            No submissions submitted yet.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-4">
                            {submissions.map(sub => (
                              <div key={sub.id} className="glass-card rounded-xl p-4 border border-slate-200/50 flex flex-col justify-between gap-3">
                                <div>
                                  <div className="flex justify-between items-start">
                                    <p className="font-bold text-slate-800 text-xs">{sub.student.name}</p>
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                                      sub.pointsObtained !== null ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                    }`}>
                                      {sub.pointsObtained !== null ? `Graded: ${sub.grade}` : 'Pending review'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-1">Submitted: {new Date(sub.submittedAt).toLocaleString()}</p>
                                  <p className="text-[10px] font-semibold text-primary-600 mt-2 bg-slate-50 p-2 rounded border border-slate-100 truncate">
                                    File: {sub.fileName}
                                  </p>
                                </div>

                                <button
                                  onClick={() => setGradeForm({ ...gradeForm, submissionId: sub.id })}
                                  className="w-full py-1.5 hover:bg-primary-600 hover:text-white border border-primary-600 text-primary-600 rounded-lg text-[10px] font-bold smooth-hover cursor-pointer"
                                >
                                  Grade Submission
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right creators */}
                  <div className="space-y-6">
                    {/* Add Assignment form */}
                    <div className="glass-card rounded-2xl p-6 border border-slate-200/50">
                      <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                        <Plus className="w-4 h-4 text-primary-600" />
                        <h4 className="font-bold text-slate-900 text-sm">Add Assignment</h4>
                      </div>
                      <form onSubmit={handleCreateAssignment} className="space-y-3.5 text-xs font-semibold text-slate-500">
                        <div>
                          <label className="block mb-1">Target Class Section</label>
                          <select
                            value={assignmentForm.courseOfferingId}
                            onChange={e => setAssignmentForm({ ...assignmentForm, courseOfferingId: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800"
                            required
                          >
                            <option value="">Select Section</option>
                            {sections.map(s => (
                              <option key={s.id} value={s.id}>
                                [{s.section?.department?.code || 'CSE'} - {s.section?.name}] {s.course?.name} ({s.course?.code})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block mb-1">Assignment Title</label>
                          <input
                            type="text"
                            value={assignmentForm.title}
                            onChange={e => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                            placeholder="Homework 1: SQL queries"
                            required
                          />
                        </div>
                        <div>
                          <label className="block mb-1">Instruction / Details</label>
                          <textarea
                            value={assignmentForm.description}
                            onChange={e => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 h-16"
                            placeholder="Write homework instructions..."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block mb-1">Max Score</label>
                            <input
                              type="number"
                              value={assignmentForm.maxPoints}
                              onChange={e => setAssignmentForm({ ...assignmentForm, maxPoints: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                              required
                            />
                          </div>
                          <div>
                            <label className="block mb-1">Due Date</label>
                            <input
                              type="date"
                              value={assignmentForm.dueDate}
                              onChange={e => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                              required
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs smooth-hover cursor-pointer"
                        >
                          Publish Assignment
                        </button>
                      </form>
                    </div>

                    {/* Grading modal-form overlay */}
                    {gradeForm.submissionId && (
                      <div className="glass-card rounded-2xl p-6 border border-slate-200/50 bg-amber-50/40">
                        <div className="flex justify-between items-center mb-4 border-b border-amber-200/50 pb-2">
                          <h4 className="font-bold text-slate-900 text-sm">Grading console</h4>
                          <button onClick={() => setGradeForm({ ...gradeForm, submissionId: '' })} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <form onSubmit={handleGradeSubmission} className="space-y-3.5 text-xs font-semibold text-slate-500">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block mb-1">Score Obtained</label>
                              <input
                                type="number"
                                value={gradeForm.pointsObtained}
                                onChange={e => setGradeForm({ ...gradeForm, pointsObtained: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800"
                                placeholder="95"
                                required
                              />
                            </div>
                            <div>
                              <label className="block mb-1">Letter Grade</label>
                              <select
                                value={gradeForm.grade}
                                onChange={e => setGradeForm({ ...gradeForm, grade: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800 animate-none"
                              >
                                <option value="A+">A+</option>
                                <option value="A">A</option>
                                <option value="B+">B+</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="F">F</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block mb-1">Grading Feedback</label>
                            <textarea
                              value={gradeForm.feedback}
                              onChange={e => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800 h-14"
                              placeholder="Write evaluation comments..."
                            />
                          </div>
                          <button
                            type="submit"
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs smooth-hover cursor-pointer"
                          >
                            Submit Assessment
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: EXAMINATIONS DESK */}
              {activeTab === 'exams' && (
                <div className="grid grid-cols-3 gap-8">
                  <div className="col-span-2 space-y-6">
                    <div className="glass-card rounded-2xl border border-slate-200/50 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="px-6 py-3.5">Exam Name</th>
                            <th className="px-6 py-3.5">Course Section</th>
                            <th className="px-6 py-3.5 text-center">Exam Date</th>
                            <th className="px-6 py-3.5 text-right">Grades</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {exams.map(exam => (
                            <tr 
                              key={exam.id}
                              onClick={() => handleLoadExamGrades(exam.id)}
                              className={`hover:bg-slate-50/50 smooth-hover cursor-pointer ${selectedExamId === exam.id ? 'bg-primary-50/30' : ''}`}
                            >
                              <td className="px-6 py-3.5 font-bold text-slate-800">{exam.title}</td>
                              <td className="px-6 py-3.5 text-xs text-slate-500">
                                {exam.courseOffering?.course?.name || exam.classSection?.course?.name || 'N/A'}
                              </td>
                              <td className="px-6 py-3.5 text-center text-xs font-semibold text-slate-400 font-sans">
                                {new Date(exam.date).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-3.5 text-right font-bold text-primary-700">
                                Record Marks
                                <ChevronRight className="w-4 h-4 inline-block ml-1" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Class grading roster */}
                    {selectedExamId && (
                      <div className="glass-card rounded-2xl border border-slate-200/50 overflow-hidden">
                        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200/50 flex justify-between items-center">
                          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Class Grading Roster</h4>
                        </div>
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              <th className="px-6 py-2.5">Roll Number</th>
                              <th className="px-6 py-2.5">Student Name</th>
                              <th className="px-6 py-2.5 text-right">Update Grade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {examGrades.map(s => (
                              <tr key={s.id} className="hover:bg-slate-50/50 smooth-hover">
                                <td className="px-6 py-2.5 font-bold text-slate-900">{s.rollNumber}</td>
                                <td className="px-6 py-2.5 font-medium text-slate-700">{s.name}</td>
                                <td className="px-6 py-2.5 text-right">
                                  <button
                                    onClick={() => setExamGradeForm({ ...examGradeForm, studentId: s.id })}
                                    className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded text-[9px] font-bold smooth-hover cursor-pointer"
                                  >
                                    Input Score
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    {/* Add exam form */}
                    <div className="glass-card rounded-2xl p-6 border border-slate-200/50">
                      <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                        <Plus className="w-4 h-4 text-primary-600" />
                        <h4 className="font-bold text-slate-900 text-sm">Add Examination</h4>
                      </div>
                      <form onSubmit={handleCreateExam} className="space-y-3.5 text-xs font-semibold text-slate-500">
                        <div>
                          <label className="block mb-1">Target Class Section</label>
                          <select
                            value={examForm.courseOfferingId}
                            onChange={e => setExamForm({ ...examForm, courseOfferingId: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800"
                            required
                          >
                            <option value="">Select Section</option>
                            {sections.map(s => (
                              <option key={s.id} value={s.id}>
                                [{s.section?.department?.code || 'CSE'} - {s.section?.name}] {s.course?.name} ({s.course?.code})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block mb-1">Exam Title</label>
                          <input
                            type="text"
                            value={examForm.title}
                            onChange={e => setExamForm({ ...examForm, title: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                            placeholder="Midterm Exam"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block mb-1">Max Score</label>
                            <input
                              type="number"
                              value={examForm.maxPoints}
                              onChange={e => setExamForm({ ...examForm, maxPoints: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                              required
                            />
                          </div>
                          <div>
                            <label className="block mb-1">Weightage (e.g. 0.3)</label>
                            <input
                              type="text"
                              value={examForm.weight}
                              onChange={e => setExamForm({ ...examForm, weight: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                              placeholder="0.3"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block mb-1">Exam Date</label>
                          <input
                            type="date"
                            value={examForm.date}
                            onChange={e => setExamForm({ ...examForm, date: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                            required
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs smooth-hover cursor-pointer"
                        >
                          Create Exam
                        </button>
                      </form>
                    </div>

                    {/* Grade exam form overlay */}
                    {examGradeForm.studentId && (
                      <div className="glass-card rounded-2xl p-6 border border-slate-200/50 bg-amber-50/40">
                        <div className="flex justify-between items-center mb-4 border-b border-amber-200/50 pb-2">
                          <h4 className="font-bold text-slate-900 text-sm">Input Exam Score</h4>
                          <button onClick={() => setExamGradeForm({ ...examGradeForm, studentId: '' })} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <form onSubmit={handleGradeExam} className="space-y-3.5 text-xs font-semibold text-slate-500">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block mb-1">Score Obtained</label>
                              <input
                                type="number"
                                value={examGradeForm.pointsObtained}
                                onChange={e => setExamGradeForm({ ...examGradeForm, pointsObtained: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800"
                                placeholder="45"
                                required
                              />
                            </div>
                            <div>
                              <label className="block mb-1">Letter Grade</label>
                              <select
                                value={examGradeForm.letterGrade}
                                onChange={e => setExamGradeForm({ ...examGradeForm, letterGrade: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800"
                              >
                                <option value="A+">A+</option>
                                <option value="A">A</option>
                                <option value="B+">B+</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="F">F</option>
                              </select>
                            </div>
                          </div>
                          <button
                            type="submit"
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs smooth-hover cursor-pointer"
                          >
                            Save Exam Score
                          </button>
                        </form>
                      </div>
                    )}
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

export default LecturerPortal;
