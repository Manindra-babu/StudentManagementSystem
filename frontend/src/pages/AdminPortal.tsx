import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Users, UserCheck, BookOpen, DollarSign, LogOut, ShieldAlert,
  Search, Plus, Trash2, Calendar, FileText,
  UserPlus, BookPlus, RefreshCw, Layers
} from 'lucide-react';
import { ChatWidget } from '../components/ChatWidget';
import { Logo } from '../components/Logo';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const AdminPortal: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [lecturers, setLecturers] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [deptSections, setDeptSections] = useState<any[]>([]);
  const [lecturerAssignments, setLecturerAssignments] = useState<any[]>([]);
  const [courseOfferings, setCourseOfferings] = useState<any[]>([]);
  const [sections] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [studentForm, setStudentForm] = useState({ name: '', email: '', rollNumber: '', phone: '', departmentId: '', programId: '', admissionYear: '2026' });
  const [lecturerForm, setLecturerForm] = useState({ name: '', email: '', employeeId: '', phone: '', departmentId: '' });
  const [courseForm, setCourseForm] = useState({ name: '', code: '', creditHours: '3', departmentId: '' });
  const [sectionForm, setSectionForm] = useState({ name: 'Section A', courseId: '', lecturerId: '', semester: 'Fall 2026', timetable: [{ dayOfWeek: '1', startTime: '09:00', endTime: '10:30', room: 'Room 101' }] });
  const [feeForm, setFeeForm] = useState({ title: 'Tuition Fee - Fall 2026', amount: '2500', dueDate: '2026-09-30', programId: '' });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', targetRole: 'ALL' });

  // New Management Forms
  const [deptSectionForm, setDeptSectionForm] = useState({ name: 'CSE-A', academicYear: '2026-2027', semester: 'Fall 2026' });
  const [assignForm, setAssignForm] = useState({ lecturerId: '', sectionId: '' });
  const [offeringForm, setOfferingForm] = useState({ courseId: '', sectionId: '', lecturerId: '', capacity: '40', semester: 'Fall 2026' });

  // Notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resStats, resStudents, resLecturers, resCourses, resDeptSections, resAssigns, resOfferings, resFees, resDepts, resLogs] = await Promise.all([
        axios.get('/api/admin/dashboard'),
        axios.get('/api/admin/students'),
        axios.get('/api/admin/lecturers'),
        axios.get('/api/admin/courses'),
        axios.get('/api/admin/department-sections'),
        axios.get('/api/admin/lecturer-assignments'),
        axios.get('/api/admin/course-offerings'),
        axios.get('/api/admin/fees'),
        axios.get('/api/admin/departments'),
        axios.get('/api/admin/auditlogs')
      ]);

      setStats(resStats.data);
      setStudents(resStudents.data);
      setLecturers(resLecturers.data);
      setCourses(resCourses.data);
      setDeptSections(resDeptSections.data);
      setLecturerAssignments(resAssigns.data);
      setCourseOfferings(resOfferings.data);
      setFees(resFees.data);
      setDepartments(resDepts.data);
      setAuditLogs(resLogs.data);
    } catch (err) {
      console.error('Fetch admin data error:', err);
      showToast('Failed to retrieve system datasets.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // CRUD actions
  const handleAddDeptSection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/admin/department-sections', deptSectionForm);
      showToast('Department Section created!');
      setDeptSectionForm({ name: '', academicYear: '2026-2027', semester: 'Fall 2026' });
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create section.', 'error');
    }
  };

  const handleAssignLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/admin/lecturer-assignments', assignForm);
      showToast('Lecturer assigned to section!');
      setAssignForm({ lecturerId: '', sectionId: '' });
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Assignment failed.', 'error');
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    try {
      await axios.delete(`/api/admin/lecturer-assignments/${id}`);
      showToast('Assignment removed.');
      fetchData();
    } catch (err) {
      showToast('Action failed.', 'error');
    }
  };

  const handleAddOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/admin/course-offerings', offeringForm);
      showToast('Course offering created successfully!');
      setOfferingForm({ courseId: '', sectionId: '', lecturerId: '', capacity: '40', semester: 'Fall 2026' });
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Course offering failed.', 'error');
    }
  };

  // CRUD actions
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/admin/students', studentForm);
      showToast('Student enrolled successfully!');
      setStudentForm({ name: '', email: '', rollNumber: '', phone: '', departmentId: '', programId: '', admissionYear: '2026' });
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to enroll student.', 'error');
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this student?')) return;
    try {
      await axios.delete(`/api/admin/students/${id}`);
      showToast('Student deleted.');
      fetchData();
    } catch (err) {
      showToast('Deletion failed.', 'error');
    }
  };

  const handleAddLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/admin/lecturers', lecturerForm);
      showToast('Lecturer registered.');
      setLecturerForm({ name: '', email: '', employeeId: '', phone: '', departmentId: '' });
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to add lecturer.', 'error');
    }
  };

  const handleDeleteLecturer = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this faculty member?')) return;
    try {
      await axios.delete(`/api/admin/lecturers/${id}`);
      showToast('Lecturer removed.');
      fetchData();
    } catch (err) {
      showToast('Deletion failed.', 'error');
    }
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/admin/courses', courseForm);
      showToast('Course curriculum created.');
      setCourseForm({ name: '', code: '', creditHours: '3', departmentId: '' });
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to add course.', 'error');
    }
  };

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/admin/sections', sectionForm);
      showToast('Class Section scheduled.');
      setSectionForm({ name: 'Section A', courseId: '', lecturerId: '', semester: 'Fall 2026', timetable: [{ dayOfWeek: '1', startTime: '09:00', endTime: '10:30', room: 'Room 101' }] });
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to schedule section.', 'error');
    }
  };

  const handleAssignFees = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/admin/fees', feeForm);
      showToast('Academic invoices assigned.');
      setFeeForm({ title: 'Tuition Fee - Fall 2026', amount: '2500', dueDate: '2026-09-30', programId: '' });
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to assign fees.', 'error');
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/admin/announcements', announcementForm);
      showToast('Announcement posted.');
      setAnnouncementForm({ title: '', content: '', targetRole: 'ALL' });
    } catch (err) {
      showToast('Failed to post announcement.', 'error');
    }
  };

  // Compile Recharts aggregates
  const getEnrollmentData = () => {
    const counts: { [key: string]: number } = {};
    students.forEach(s => {
      const name = s.department?.code || 'Undecided';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, count: counts[key] }));
  };

  const getFeePieData = () => {
    if (!stats?.feeStats) return [];
    return [
      { name: 'Paid', value: stats.feeStats.totalPaid },
      { name: 'Unpaid Dues', value: stats.feeStats.unpaidAmount }
    ];
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-5 right-5 px-5 py-3 rounded-xl shadow-lg text-white font-medium text-sm transition-all z-50 ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Admin Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-100">
          <Logo size={38} />
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'dashboard', label: 'Analytics Dashboard', icon: Layers },
            { id: 'dept-sections', label: 'Department Sections', icon: Layers },
            { id: 'lecturer-assign', label: 'Lecturer Assignments', icon: UserPlus },
            { id: 'course-offerings', label: 'Course Offerings', icon: BookPlus },
            { id: 'students', label: 'Student Directory', icon: Users },
            { id: 'lecturers', label: 'Lecturers Desk', icon: UserCheck },
            { id: 'courses', label: 'Curriculums', icon: BookOpen },
            { id: 'fees', label: 'Fees & Billings', icon: DollarSign },
            { id: 'audit', label: 'Audit Registers', icon: FileText }
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
              AD
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">{user?.profile?.name}</p>
              <span className="text-[9px] text-slate-400 font-medium truncate block">Administrator</span>
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
        {/* Topbar Header */}
        <header className="h-16 bg-white border-b border-slate-100 px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-outfit text-slate-900 capitalize">
              {activeTab === 'audit' ? 'System Audit Logs' : activeTab.replace('-', ' ')}
            </h1>
            <span className="px-3 py-1 bg-primary-50 border border-primary-100 text-primary-700 font-extrabold rounded-full text-xs flex items-center gap-1.5 shadow-sm">
              <ShieldAlert className="w-3.5 h-3.5 text-primary-600" />
              Department: {stats?.department?.name || user?.profile?.department?.name || 'Computer Science & Engineering'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={fetchData}
              className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl smooth-hover border border-slate-200/50 cursor-pointer"
              title="Sync Datasets"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-slate-200" />
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-700">Academix Admin Desk</p>
              <p className="text-[10px] text-slate-400">Department Scoped</p>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-8">
          {loading ? (
            <div className="h-[60vh] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
            <>
              {/* TAB 1: ANALYTICS DASHBOARD */}
              {activeTab === 'dashboard' && stats && (
                <div className="space-y-8">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-6">
                    {[
                      { label: 'Total Enrolled Students', value: stats.totalStudents, icon: Users, color: 'bg-indigo-50 text-indigo-700' },
                      { label: 'Academic Instructors', value: stats.totalLecturers, icon: UserCheck, color: 'bg-amber-50 text-amber-700' },
                      { label: 'Syllabus Courses', value: stats.totalCourses, icon: BookOpen, color: 'bg-emerald-50 text-emerald-700' },
                      { label: 'Daily Attendance Rate', value: `${stats.attendanceRate}%`, icon: Calendar, color: 'bg-rose-50 text-rose-700' }
                    ].map((card, idx) => {
                      const Icon = card.icon;
                      return (
                        <div key={idx} className="glass-card rounded-2xl p-6 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{card.label}</p>
                            <h3 className="text-2xl font-black text-slate-900">{card.value}</h3>
                          </div>
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.color}`}>
                            <Icon className="w-6 h-6" />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Charts Row */}
                  <div className="grid grid-cols-3 gap-6">
                    {/* Bar Chart */}
                    <div className="col-span-2 glass-card rounded-2xl p-6 border border-slate-200/50">
                      <h4 className="font-bold text-slate-900 mb-6 text-sm">Students Distribution by Department</h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getEnrollmentData()}>
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                            <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.4)' }} />
                            <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Pie Chart */}
                    <div className="glass-card rounded-2xl p-6 border border-slate-200/50 flex flex-col">
                      <h4 className="font-bold text-slate-900 mb-6 text-sm">Fee Collection Status</h4>
                      <div className="h-48 flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={getFeePieData()}
                              innerRadius={60}
                              outerRadius={85}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {getFeePieData().map((_, idx) => (
                                <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `$${value}`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-around text-xs mt-2 border-t border-slate-100 pt-3">
                        <div className="flex items-center gap-1.5 font-medium text-slate-600">
                          <span className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                          Paid: ${stats.feeStats.totalPaid}
                        </div>
                        <div className="flex items-center gap-1.5 font-medium text-slate-600">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                          Unpaid: ${stats.feeStats.unpaidAmount}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Announcement & Notice Poster */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="col-span-2 glass-card rounded-2xl p-6 border border-slate-200/50">
                      <h4 className="font-bold text-slate-900 mb-4 text-sm">Post System Announcement</h4>
                      <form onSubmit={handlePostAnnouncement} className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={announcementForm.title}
                              onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                              placeholder="Announcement Title"
                              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                              required
                            />
                          </div>
                          <div>
                            <select
                              value={announcementForm.targetRole}
                              onChange={e => setAnnouncementForm({ ...announcementForm, targetRole: e.target.value })}
                              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                            >
                              <option value="ALL">All Roles</option>
                              <option value="LECTURER">Faculty Only</option>
                              <option value="STUDENT">Students Only</option>
                            </select>
                          </div>
                        </div>
                        <textarea
                          value={announcementForm.content}
                          onChange={e => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                          placeholder="Write announcement body message here..."
                          className="w-full h-24 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                          required
                        />
                        <button
                          type="submit"
                          className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow smooth-hover cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Publish Notice
                        </button>
                      </form>
                    </div>

                    <div className="glass-card rounded-2xl p-6 border border-slate-200/50 flex flex-col">
                      <h4 className="font-bold text-slate-900 mb-3 text-sm">Recent Activity</h4>
                      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                        {stats.auditLogs.map((log: any) => (
                          <div key={log.id} className="flex gap-3 text-xs border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-200 mt-1 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-800 leading-snug">{log.action}</p>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">{log.details}</p>
                              <span className="text-[8px] font-medium text-slate-300 block mt-1">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: DEPARTMENT SECTIONS */}
              {activeTab === 'dept-sections' && (
                <div className="grid grid-cols-3 gap-8">
                  <div className="col-span-2 space-y-4">
                    <h3 className="font-bold text-slate-900 text-sm">Active Department Sections</h3>
                    <div className="glass-card rounded-2xl border border-slate-200/50 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="px-6 py-3.5">Section Name</th>
                            <th className="px-6 py-3.5">Academic Year</th>
                            <th className="px-6 py-3.5">Semester</th>
                            <th className="px-6 py-3.5 text-center">Students Enrolled</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {deptSections.map(sec => (
                            <tr key={sec.id} className="hover:bg-slate-50/50 smooth-hover">
                              <td className="px-6 py-3.5 font-bold text-slate-900">{sec.name}</td>
                              <td className="px-6 py-3.5 text-slate-600 text-xs">{sec.academicYear}</td>
                              <td className="px-6 py-3.5 text-slate-600 text-xs">{sec.semester}</td>
                              <td className="px-6 py-3.5 text-center">
                                <span className="px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 font-bold text-xs">
                                  {sec._count?.students || 0} Students
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Create Section Form */}
                  <div className="glass-card rounded-2xl p-6 border border-slate-200/50 h-fit">
                    <h4 className="font-bold text-slate-900 mb-4 text-sm flex items-center gap-2">
                      <Plus className="w-4 h-4 text-primary-600" />
                      Create New Section
                    </h4>
                    <form onSubmit={handleAddDeptSection} className="space-y-4 text-xs font-semibold text-slate-600">
                      <div>
                        <label className="block mb-1">Section Name</label>
                        <input
                          type="text"
                          value={deptSectionForm.name}
                          onChange={e => setDeptSectionForm({ ...deptSectionForm, name: e.target.value })}
                          placeholder="e.g. CSE-A"
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-800"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Academic Year</label>
                        <input
                          type="text"
                          value={deptSectionForm.academicYear}
                          onChange={e => setDeptSectionForm({ ...deptSectionForm, academicYear: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-800"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Semester</label>
                        <input
                          type="text"
                          value={deptSectionForm.semester}
                          onChange={e => setDeptSectionForm({ ...deptSectionForm, semester: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-800"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl smooth-hover shadow cursor-pointer"
                      >
                        Create Section
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB: LECTURER ASSIGNMENTS */}
              {activeTab === 'lecturer-assign' && (
                <div className="grid grid-cols-3 gap-8">
                  <div className="col-span-2 space-y-4">
                    <h3 className="font-bold text-slate-900 text-sm">Lecturer-Section Assignments</h3>
                    <div className="glass-card rounded-2xl border border-slate-200/50 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="px-6 py-3.5">Faculty Member</th>
                            <th className="px-6 py-3.5">Assigned Section</th>
                            <th className="px-6 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {lecturerAssignments.map(as => (
                            <tr key={as.id} className="hover:bg-slate-50/50 smooth-hover">
                              <td className="px-6 py-3.5 font-bold text-slate-900">{as.lecturer.name} ({as.lecturer.employeeId})</td>
                              <td className="px-6 py-3.5 font-semibold text-primary-700">{as.section.name}</td>
                              <td className="px-6 py-3.5 text-right">
                                <button
                                  onClick={() => handleRemoveAssignment(as.id)}
                                  className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg smooth-hover cursor-pointer"
                                  title="Remove Assignment"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Assign Form */}
                  <div className="glass-card rounded-2xl p-6 border border-slate-200/50 h-fit">
                    <h4 className="font-bold text-slate-900 mb-4 text-sm flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-primary-600" />
                      Assign Faculty to Section
                    </h4>
                    <form onSubmit={handleAssignLecturer} className="space-y-4 text-xs font-semibold text-slate-600">
                      <div>
                        <label className="block mb-1">Faculty Lecturer</label>
                        <select
                          value={assignForm.lecturerId}
                          onChange={e => setAssignForm({ ...assignForm, lecturerId: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-800 bg-white"
                          required
                        >
                          <option value="">Select Lecturer...</option>
                          {lecturers.map(l => (
                            <option key={l.id} value={l.id}>{l.name} ({l.employeeId})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block mb-1">Target Section</label>
                        <select
                          value={assignForm.sectionId}
                          onChange={e => setAssignForm({ ...assignForm, sectionId: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-800 bg-white"
                          required
                        >
                          <option value="">Select Section...</option>
                          {deptSections.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.academicYear})</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl smooth-hover shadow cursor-pointer"
                      >
                        Assign Faculty
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB: COURSE OFFERINGS */}
              {activeTab === 'course-offerings' && (
                <div className="grid grid-cols-3 gap-8">
                  <div className="col-span-2 space-y-4">
                    <h3 className="font-bold text-slate-900 text-sm">Course Offerings Master</h3>
                    <div className="glass-card rounded-2xl border border-slate-200/50 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="px-6 py-3.5">Course</th>
                            <th className="px-6 py-3.5">Section</th>
                            <th className="px-6 py-3.5">Instructor</th>
                            <th className="px-6 py-3.5 text-center">Capacity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {courseOfferings.map(off => (
                            <tr key={off.id} className="hover:bg-slate-50/50 smooth-hover">
                              <td className="px-6 py-3.5 font-bold text-slate-900">{off.course.name} ({off.course.code})</td>
                              <td className="px-6 py-3.5 text-xs text-slate-600 font-semibold">{off.section.name}</td>
                              <td className="px-6 py-3.5 text-xs text-slate-600">{off.lecturer.name}</td>
                              <td className="px-6 py-3.5 text-center">
                                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs">
                                  {off._count?.enrollments || 0} / {off.capacity} Seats
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Create Offering Form */}
                  <div className="glass-card rounded-2xl p-6 border border-slate-200/50 h-fit">
                    <h4 className="font-bold text-slate-900 mb-4 text-sm flex items-center gap-2">
                      <BookPlus className="w-4 h-4 text-primary-600" />
                      Create Course Offering
                    </h4>
                    <form onSubmit={handleAddOffering} className="space-y-4 text-xs font-semibold text-slate-600">
                      <div>
                        <label className="block mb-1">Course</label>
                        <select
                          value={offeringForm.courseId}
                          onChange={e => setOfferingForm({ ...offeringForm, courseId: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-800 bg-white"
                          required
                        >
                          <option value="">Select Course...</option>
                          {courses.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block mb-1">Target Section</label>
                        <select
                          value={offeringForm.sectionId}
                          onChange={e => setOfferingForm({ ...offeringForm, sectionId: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-800 bg-white"
                          required
                        >
                          <option value="">Select Section...</option>
                          {deptSections.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.academicYear})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block mb-1">Assigned Instructor</label>
                        <select
                          value={offeringForm.lecturerId}
                          onChange={e => setOfferingForm({ ...offeringForm, lecturerId: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-800 bg-white"
                          required
                        >
                          <option value="">Select Lecturer...</option>
                          {lecturers.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block mb-1">Max Student Capacity</label>
                        <input
                          type="number"
                          value={offeringForm.capacity}
                          onChange={e => setOfferingForm({ ...offeringForm, capacity: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-800"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl smooth-hover shadow cursor-pointer"
                      >
                        Publish Offering
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 2: STUDENTS DIRECTORY */}
              {activeTab === 'students' && (
                <div className="grid grid-cols-3 gap-8">
                  {/* List View */}
                  <div className="col-span-2 space-y-4">
                    {/* Search & Header */}
                    <div className="flex gap-4">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Search students by name, roll number, or email..."
                          className="w-full pl-11 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                        />
                      </div>
                    </div>

                    {/* Table Card */}
                    <div className="glass-card rounded-2xl border border-slate-200/50 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="px-6 py-3.5">Roll No</th>
                            <th className="px-6 py-3.5">Name</th>
                            <th className="px-6 py-3.5">Email</th>
                            <th className="px-6 py-3.5">Department</th>
                            <th className="px-6 py-3.5 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {students
                            .filter(s => 
                              s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              s.email.toLowerCase().includes(searchQuery.toLowerCase())
                            )
                            .map(student => (
                              <tr key={student.id} className="hover:bg-slate-50/50 smooth-hover">
                                <td className="px-6 py-3.5 font-bold text-slate-900">{student.rollNumber}</td>
                                <td className="px-6 py-3.5 font-medium text-slate-700">{student.name}</td>
                                <td className="px-6 py-3.5 text-slate-500 text-xs">{student.email}</td>
                                <td className="px-6 py-3.5">
                                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                                    {student.department?.code || 'N/A'}
                                  </span>
                                </td>
                                <td className="px-6 py-3.5 text-center">
                                  <button
                                    onClick={() => handleDeleteStudent(student.id)}
                                    className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg smooth-hover cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Enrollment Side Panel */}
                  <div className="glass-card rounded-2xl p-6 border border-slate-200/50 h-fit sticky top-24">
                    <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                      <UserPlus className="w-5 h-5 text-primary-600" />
                      <h4 className="font-bold text-slate-900 text-sm">Enroll New Student</h4>
                    </div>
                    <form onSubmit={handleAddStudent} className="space-y-4 text-xs font-semibold text-slate-500">
                      <div>
                        <label className="block mb-1">Full Name</label>
                        <input
                          type="text"
                          value={studentForm.name}
                          onChange={e => setStudentForm({ ...studentForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                          placeholder="e.g. Alice Vance"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Roll Number</label>
                        <input
                          type="text"
                          value={studentForm.rollNumber}
                          onChange={e => setStudentForm({ ...studentForm, rollNumber: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                          placeholder="e.g. CS2026041"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Institutional Email</label>
                        <input
                          type="email"
                          value={studentForm.email}
                          onChange={e => setStudentForm({ ...studentForm, email: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                          placeholder="alice.vance@academix.edu"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Academic Department</label>
                        <select
                          value={studentForm.departmentId}
                          onChange={e => {
                            const dept = departments.find(d => d.id === e.target.value);
                            setStudentForm({ 
                              ...studentForm, 
                              departmentId: e.target.value,
                              programId: dept?.programs?.[0]?.id || '' 
                            });
                          }}
                          className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800"
                          required
                        >
                          <option value="">Select Department</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      {studentForm.departmentId && (
                        <div>
                          <label className="block mb-1">Degree Program</label>
                          <select
                            value={studentForm.programId}
                            onChange={e => setStudentForm({ ...studentForm, programId: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800"
                            required
                          >
                            <option value="">Select Program</option>
                            {departments
                              .find(d => d.id === studentForm.departmentId)
                              ?.programs.map((p: any) => (
                                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                              ))}
                          </select>
                        </div>
                      )}
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 smooth-hover shadow cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Enroll Student
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 3: LECTURERS DIRECTORY */}
              {activeTab === 'lecturers' && (
                <div className="grid grid-cols-3 gap-8">
                  <div className="col-span-2">
                    <div className="glass-card rounded-2xl border border-slate-200/50 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="px-6 py-3.5">Emp ID</th>
                            <th className="px-6 py-3.5">Faculty Name</th>
                            <th className="px-6 py-3.5">Email</th>
                            <th className="px-6 py-3.5">Department</th>
                            <th className="px-6 py-3.5 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {lecturers.map(lecturer => (
                            <tr key={lecturer.id} className="hover:bg-slate-50/50 smooth-hover">
                              <td className="px-6 py-3.5 font-bold text-slate-900">{lecturer.employeeId}</td>
                              <td className="px-6 py-3.5 font-medium text-slate-700">{lecturer.name}</td>
                              <td className="px-6 py-3.5 text-slate-500 text-xs">{lecturer.email}</td>
                              <td className="px-6 py-3.5">
                                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                                  {lecturer.department?.code || 'N/A'}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 text-center">
                                <button
                                  onClick={() => handleDeleteLecturer(lecturer.id)}
                                  className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg smooth-hover cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-6 border border-slate-200/50 h-fit sticky top-24">
                    <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                      <UserPlus className="w-5 h-5 text-primary-600" />
                      <h4 className="font-bold text-slate-900 text-sm">Register Faculty</h4>
                    </div>
                    <form onSubmit={handleAddLecturer} className="space-y-4 text-xs font-semibold text-slate-500">
                      <div>
                        <label className="block mb-1">Full Name</label>
                        <input
                          type="text"
                          value={lecturerForm.name}
                          onChange={e => setLecturerForm({ ...lecturerForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                          placeholder="e.g. Dr. Ada Lovelace"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Employee ID</label>
                        <input
                          type="text"
                          value={lecturerForm.employeeId}
                          onChange={e => setLecturerForm({ ...lecturerForm, employeeId: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                          placeholder="e.g. LEC006"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Email Address</label>
                        <input
                          type="email"
                          value={lecturerForm.email}
                          onChange={e => setLecturerForm({ ...lecturerForm, email: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                          placeholder="ada.lovelace@academix.edu"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Department assignment</label>
                        <select
                          value={lecturerForm.departmentId}
                          onChange={e => setLecturerForm({ ...lecturerForm, departmentId: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800"
                          required
                        >
                          <option value="">Select Department</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 smooth-hover shadow cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Add Lecturer
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 4: COURSES & CURRICULUMS */}
              {activeTab === 'courses' && (
                <div className="grid grid-cols-3 gap-8">
                  <div className="col-span-2">
                    <div className="glass-card rounded-2xl border border-slate-200/50 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="px-6 py-3.5">Course Code</th>
                            <th className="px-6 py-3.5">Course Title</th>
                            <th className="px-6 py-3.5 text-center">Credit Hours</th>
                            <th className="px-6 py-3.5">Departmnt ID</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {courses.map(course => (
                            <tr key={course.id} className="hover:bg-slate-50/50 smooth-hover">
                              <td className="px-6 py-3.5 font-bold text-slate-900">{course.code}</td>
                              <td className="px-6 py-3.5 font-medium text-slate-700">{course.name}</td>
                              <td className="px-6 py-3.5 text-center font-semibold text-slate-600">{course.creditHours}</td>
                              <td className="px-6 py-3.5 text-slate-400 text-xs truncate max-w-[120px]">{course.departmentId || 'Common'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-6 border border-slate-200/50 h-fit sticky top-24">
                    <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                      <BookPlus className="w-5 h-5 text-primary-600" />
                      <h4 className="font-bold text-slate-900 text-sm">Create Course</h4>
                    </div>
                    <form onSubmit={handleAddCourse} className="space-y-4 text-xs font-semibold text-slate-500">
                      <div>
                        <label className="block mb-1">Course Title</label>
                        <input
                          type="text"
                          value={courseForm.name}
                          onChange={e => setCourseForm({ ...courseForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                          placeholder="e.g. Operating Systems"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Course Code</label>
                        <input
                          type="text"
                          value={courseForm.code}
                          onChange={e => setCourseForm({ ...courseForm, code: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                          placeholder="e.g. CS-201"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Credit Hours</label>
                        <input
                          type="number"
                          value={courseForm.creditHours}
                          onChange={e => setCourseForm({ ...courseForm, creditHours: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                          min="1"
                          max="6"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Department</label>
                        <select
                          value={courseForm.departmentId}
                          onChange={e => setCourseForm({ ...courseForm, departmentId: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800"
                        >
                          <option value="">Select Department (Common)</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 smooth-hover shadow cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Create Course
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 5: TIMETABLE BUILDER */}
              {activeTab === 'timetable' && (
                <div className="grid grid-cols-3 gap-8">
                  <div className="col-span-2 space-y-4">
                    {sections.map(section => (
                      <div key={section.id} className="glass-card rounded-2xl p-6 border border-slate-200/50">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">
                              {section.course.name} ({section.course.code}) - {section.name}
                            </h4>
                            <span className="text-[10px] font-bold text-primary-600 uppercase tracking-wide mt-1 block">
                              Semester: {section.semester}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-slate-600">Instructor: {section.lecturer.name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Enrolled: {section.timetable.length} classes scheduled</p>
                          </div>
                        </div>

                        {/* Display Schedules */}
                        <div className="grid grid-cols-2 gap-4">
                          {section.timetable.map((slot: any) => {
                            const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                            return (
                              <div key={slot.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                                <Calendar className="w-4 h-4 text-primary-500 shrink-0" />
                                <div>
                                  <p className="text-xs font-bold text-slate-700">{days[slot.dayOfWeek]}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    {slot.startTime} - {slot.endTime} • Room {slot.room}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="glass-card rounded-2xl p-6 border border-slate-200/50 h-fit sticky top-24">
                    <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                      <BookPlus className="w-5 h-5 text-primary-600" />
                      <h4 className="font-bold text-slate-900 text-sm">Schedule Class Section</h4>
                    </div>
                    <form onSubmit={handleAddSection} className="space-y-4 text-xs font-semibold text-slate-500">
                      <div>
                        <label className="block mb-1">Section Title</label>
                        <input
                          type="text"
                          value={sectionForm.name}
                          onChange={e => setSectionForm({ ...sectionForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                          placeholder="Section A"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Select Syllabus Course</label>
                        <select
                          value={sectionForm.courseId}
                          onChange={e => setSectionForm({ ...sectionForm, courseId: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800"
                          required
                        >
                          <option value="">Select Course</option>
                          {courses.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block mb-1">Select Assignee Faculty</label>
                        <select
                          value={sectionForm.lecturerId}
                          onChange={e => setSectionForm({ ...sectionForm, lecturerId: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800"
                          required
                        >
                          <option value="">Select Lecturer</option>
                          {lecturers.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block mb-1">Academic Semester</label>
                        <input
                          type="text"
                          value={sectionForm.semester}
                          onChange={e => setSectionForm({ ...sectionForm, semester: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 smooth-hover shadow cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Schedule Class Section
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 6: FEES & BILLINGS */}
              {activeTab === 'fees' && (
                <div className="grid grid-cols-3 gap-8">
                  {/* Fee list */}
                  <div className="col-span-2">
                    <div className="glass-card rounded-2xl border border-slate-200/50 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="px-6 py-3.5">Student</th>
                            <th className="px-6 py-3.5">Invoiced Item</th>
                            <th className="px-6 py-3.5">Billing Amt</th>
                            <th className="px-6 py-3.5 text-center">Dues Date</th>
                            <th className="px-6 py-3.5 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {fees.map(fee => (
                            <tr key={fee.id} className="hover:bg-slate-50/50 smooth-hover">
                              <td className="px-6 py-3.5 font-medium text-slate-700">
                                <div>{fee.student.name}</div>
                                <div className="text-[10px] text-slate-400 font-semibold">{fee.student.rollNumber}</div>
                              </td>
                              <td className="px-6 py-3.5 text-slate-600 text-xs">{fee.title}</td>
                              <td className="px-6 py-3.5 font-bold text-slate-800">${fee.amount}</td>
                              <td className="px-6 py-3.5 text-center text-xs text-slate-400 font-semibold">
                                {new Date(fee.dueDate).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-3.5 text-center">
                                <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase ${
                                  fee.status === 'PAID' 
                                    ? 'bg-emerald-50 text-emerald-700' 
                                    : (fee.status === 'OVERDUE' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700')
                                }`}>
                                  {fee.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Assign invoice form */}
                  <div className="glass-card rounded-2xl p-6 border border-slate-200/50 h-fit sticky top-24">
                    <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                      <DollarSign className="w-5 h-5 text-primary-600" />
                      <h4 className="font-bold text-slate-900 text-sm">Assign Fee Invoices</h4>
                    </div>
                    <form onSubmit={handleAssignFees} className="space-y-4 text-xs font-semibold text-slate-500">
                      <div>
                        <label className="block mb-1">Billing Title</label>
                        <input
                          type="text"
                          value={feeForm.title}
                          onChange={e => setFeeForm({ ...feeForm, title: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                          placeholder="Tuition Fee - Fall 2026"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Billing Amount ($)</label>
                        <input
                          type="number"
                          value={feeForm.amount}
                          onChange={e => setFeeForm({ ...feeForm, amount: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                          placeholder="2500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Dues Date Limit</label>
                        <input
                          type="date"
                          value={feeForm.dueDate}
                          onChange={e => setFeeForm({ ...feeForm, dueDate: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-1">Assign to Degree Program (Optional)</label>
                        <select
                          value={feeForm.programId}
                          onChange={e => setFeeForm({ ...feeForm, programId: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-800"
                        >
                          <option value="">All Students</option>
                          {departments.flatMap(d => d.programs).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 smooth-hover shadow cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Assign Invoices
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 7: AUDIT LOGS */}
              {activeTab === 'audit' && (
                <div className="glass-card rounded-2xl border border-slate-200/50 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-3.5">Timestamp</th>
                        <th className="px-6 py-3.5">Actor User</th>
                        <th className="px-6 py-3.5">Security Action</th>
                        <th className="px-6 py-3.5">Description Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/50 smooth-hover">
                          <td className="px-6 py-3.5 text-slate-400 text-xs font-semibold">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="font-bold text-slate-700 text-xs block">{log.user.email}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold text-[8px] uppercase">
                              {log.user.role}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 font-bold text-primary-700 text-xs uppercase tracking-wide">
                            {log.action}
                          </td>
                          <td className="px-6 py-3.5 text-slate-600 text-xs max-w-lg truncate" title={log.details}>
                            {log.details}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

export default AdminPortal;
