// client/src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { authService } from './services/auth';
import { User } from './types/schema';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProjectDetail from './components/ProjectDetail';
import EmailConfirmation from './components/EmailConfirmation';
import './App.css';

interface Session {
  user: User;
  access_token?: string;
  [key: string]: unknown;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailConfirmed, setEmailConfirmed] = useState(true);
  const initialCheckComplete = useRef(false);

  useEffect(() => {
    checkAuth();
    const authStateChange = authService.onAuthStateChange((event: string, session: Session | null) => {
      if (!initialCheckComplete.current) return;
      
      if (session) {
        setUser(session.user);
        setEmailConfirmed(!!session.user?.email_confirmed_at);
      } else {
        setUser(null);
        setEmailConfirmed(true);
      }
    });

    return () => {
      if (authStateChange?.data?.subscription) {
        authStateChange.data.subscription.unsubscribe();
      }
    };
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const session = await authService.getSession() as Session | null;
        if (session && session.user) {
          setUser(session.user);
          setEmailConfirmed(!!session.user?.email_confirmed_at);
        } else {
          setUser(null);
          setEmailConfirmed(true);
        }
      } else {
        setUser(null);
        setEmailConfirmed(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      setEmailConfirmed(true);
    } finally {
      setLoading(false);
      initialCheckComplete.current = true;
    }
  };

  const handleLogin = async () => {
    await checkAuth();
  };

  const handleLogout = async () => {
    await authService.signOut();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-animation">
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
        </div>
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route
            path="/login"
            element={
              user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />
            }
          />
          <Route
            path="/"
            element={
              user ? (
                emailConfirmed ? (
                  <Dashboard onLogout={handleLogout} />
                ) : (
                  <EmailConfirmation />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/project/:id"
            element={
              user ? (
                emailConfirmed ? (
                  <ProjectDetail />
                ) : (
                  <EmailConfirmation />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;