// client/src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { authService } from './services/auth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProjectDetail from './components/ProjectDetail';
import EmailConfirmation from './components/EmailConfirmation';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emailConfirmed, setEmailConfirmed] = useState(true);

  useEffect(() => {
    checkAuth();
    const authStateChange = authService.onAuthStateChange((event, session) => {
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
      const session = await authService.getSession();
      if (session) {
        setUser(session.user);
        setEmailConfirmed(!!session.user?.email_confirmed_at);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    checkAuth();
  };

  const handleLogout = async () => {
    await authService.signOut();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
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