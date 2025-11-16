// client/src/components/EmailConfirmation.js
import React, { useState, useEffect } from 'react';
import { authService } from '../services/auth';
import './Login.css';

function EmailConfirmation() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const getCurrentUserEmail = async () => {
      try {
        const session = await authService.getSession();
        if (session?.user?.email) {
          setEmail(session.user.email);
        }
      } catch (err) {
        console.error('Failed to get user email:', err);
      }
    };
    getCurrentUserEmail();
  }, []);

  const handleResend = async () => {
    if (!email) {
      setError('Email address not found');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await authService.resendConfirmationEmail(email);
      setSuccess('Confirmation email sent! Please check your inbox.');
    } catch (err) {
      setError(err.message || 'Failed to send confirmation email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const session = await authService.getSession();
      if (session?.user?.email_confirmed_at) {
        window.location.reload();
      } else {
        setError('Email not confirmed yet. Please check your inbox and click the confirmation link.');
      }
    } catch (err) {
      setError('Failed to check status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>OrderedPM</h1>
        <h2>Email Confirmation Required</h2>
        
        <p style={{ color: '#b0b0b0', marginBottom: '20px', textAlign: 'center' }}>
          Please confirm your email address to access the dashboard.
        </p>

        {email && (
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <p style={{ color: '#e0e0e0', marginBottom: '10px' }}>Your email:</p>
            <p style={{ color: '#4a9eff', fontWeight: '600' }}>{email}</p>
          </div>
        )}

        {success && <div className="success-message">{success}</div>}
        {error && <div className="error-message">{error}</div>}

        <button
          onClick={handleResend}
          disabled={loading || !email}
          className="btn-primary"
          style={{ marginBottom: '10px' }}
        >
          {loading ? 'Sending...' : 'Resend Confirmation Email'}
        </button>

        <button
          onClick={handleCheckStatus}
          disabled={loading}
          className="btn-primary"
          style={{ background: '#666', marginBottom: '20px' }}
        >
          {loading ? 'Checking...' : 'Check Confirmation Status'}
        </button>

        <p style={{ color: '#b0b0b0', marginTop: '20px', textAlign: 'center', fontSize: '14px' }}>
          After confirming your email, click "Check Confirmation Status" or refresh the page.
        </p>
      </div>
    </div>
  );
}

export default EmailConfirmation;

