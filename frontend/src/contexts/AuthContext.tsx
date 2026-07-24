import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

// Configure Axios Defaults to work with Vite dev server proxy
axios.defaults.baseURL = ''; 

interface UserProfile {
  id: string;
  name: string;
  rollNumber?: string;
  employeeId?: string;
  email: string;
  phone?: string;
  department?: { id: string; name: string; code: string };
  section?: { id: string; name: string };
  program?: { name: string; code: string };
}

interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'LECTURER' | 'STUDENT';
  profile: UserProfile;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Set Auth Headers helper
  const setAuthHeader = (accessToken: string | null) => {
    if (accessToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  // Attempt to restore session on boot
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('accessToken');
      const storedRefreshToken = localStorage.getItem('refreshToken');

      if (storedToken) {
        setToken(storedToken);
        setAuthHeader(storedToken);
        try {
          const res = await axios.get('/api/auth/me');
          setUser(res.data);
        } catch (error) {
          // Token expired, attempt refresh
          if (storedRefreshToken) {
            try {
              const refreshRes = await axios.post('/api/auth/refresh', { refreshToken: storedRefreshToken });
              const newAccessToken = refreshRes.data.accessToken;
              localStorage.setItem('accessToken', newAccessToken);
              setToken(newAccessToken);
              setAuthHeader(newAccessToken);
              const userRes = await axios.get('/api/auth/me');
              setUser(userRes.data);
            } catch (err) {
              logoutLocal();
            }
          } else {
            logoutLocal();
          }
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // Axios interceptor to catch 401s and attempt refresh
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          const storedRefreshToken = localStorage.getItem('refreshToken');
          if (storedRefreshToken) {
            try {
              const res = await axios.post('/api/auth/refresh', { refreshToken: storedRefreshToken });
              const newAccessToken = res.data.accessToken;
              localStorage.setItem('accessToken', newAccessToken);
              setToken(newAccessToken);
              setAuthHeader(newAccessToken);
              originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
              return axios(originalRequest);
            } catch (refreshError) {
              logoutLocal();
            }
          }
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      const { accessToken, refreshToken, user: userData } = res.data;
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setToken(accessToken);
      setAuthHeader(accessToken);
      setUser(userData);
      return userData;
    } catch (error: any) {
      throw error.response?.data?.message || 'Login failed. Please verify credentials.';
    }
  };

  const logoutLocal = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
    setAuthHeader(null);
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (err) {
      console.warn('Logout request failed on server.');
    } finally {
      logoutLocal();
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};
