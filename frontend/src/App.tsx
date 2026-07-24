import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Login from './pages/Login';
import AdminPortal from './pages/AdminPortal';
import LecturerPortal from './pages/LecturerPortal';
import StudentPortal from './pages/StudentPortal';
import { Loader2, GraduationCap } from 'lucide-react';

const RootApp: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-accent-500 flex items-center justify-center shadow-md animate-pulse">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <h2 className="font-bold text-slate-800 text-lg tracking-tight font-outfit mt-1">Booting Academix...</h2>
          <Loader2 className="w-5 h-5 text-primary-600 animate-spin mt-2" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Render Portal depending on role
  if (user.role === 'ADMIN') {
    return <AdminPortal />;
  } else if (user.role === 'LECTURER') {
    return <LecturerPortal />;
  } else if (user.role === 'STUDENT') {
    return <StudentPortal />;
  }

  return <Login />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <RootApp />
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;
