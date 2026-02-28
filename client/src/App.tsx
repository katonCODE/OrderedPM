// client/src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { authService } from './services/auth';
import { getAccessToken } from './utils/token';
import { createProfile, getMyProfile } from './services/profile';
import { User } from './types/schema';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProjectDetail from './components/ProjectDetail';
import ShareLinkRedeem from './components/ShareLinkRedeem';
import EmailConfirmation from './components/EmailConfirmation';
import Profile from './components/Profile';
import LandingPage from './components/LandingPage';
import About from './components/About';
import ErrorBoundary from './components/ErrorBoundary';
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

  useEffect(() => {
    const createPendingProfile = async () => {
      if (!user || !emailConfirmed) return;

      const pendingUsername = localStorage.getItem('pendingUsername');
      if (!pendingUsername) return;

      try {
        const existingProfile = await getMyProfile();
        if (!existingProfile) {
          await createProfile({ username: pendingUsername });
          localStorage.removeItem('pendingUsername');
          localStorage.removeItem('pendingEmail');
        } else {
          localStorage.removeItem('pendingUsername');
          localStorage.removeItem('pendingEmail');
        }
      } catch (error) {
        console.error('Error creating pending profile:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg.includes('Profile already exists')) {
          localStorage.removeItem('pendingUsername');
          localStorage.removeItem('pendingEmail');
        }
      }
    };

    createPendingProfile();
  }, [user, emailConfirmed]);

  const checkAuth = async () => {
    try {
      const token = getAccessToken();
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
    <ErrorBoundary>
      <Router>
        <div className="App">
          <Routes>
          <Route
            path="/login"
            element={
              user ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />
            }
          />
          <Route
            path="/"
            element={
              user ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LandingPage />
              )
            }
          />
          <Route
            path="/dashboard"
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
          <Route
            path="/share-links/:token/redeem"
            element={
              user ? (
                emailConfirmed ? (
                  <ShareLinkRedeem />
                ) : (
                  <EmailConfirmation />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/u/:username"
            element={<Profile />}
          />
          <Route
            path="/about"
            element={<About />}
          />
          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/"} replace />} />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;