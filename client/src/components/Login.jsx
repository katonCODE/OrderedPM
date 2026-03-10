// client/src/components/Login.js
import React, { useState } from 'react';
import { authService } from '../services/auth';
import { createProfile } from '../services/profile';
import Navigation from './Navigation';

function Login({ onLogin }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        if (!username || !username.trim()) {
          setError('Username is required');
          setLoading(false);
          return;
        }
        const trimmedUsername = username.trim();
        if (trimmedUsername.length < 3) {
          setError('Username must be at least 3 characters long');
          setLoading(false);
          return;
        }
        if (trimmedUsername.length > 30) {
          setError('Username must be 30 characters or less');
          setLoading(false);
          return;
        }
        const data = await authService.signUp(email, password);
        setError('');
        if (data.session) {
          try {
            await createProfile({ username: trimmedUsername });
            localStorage.removeItem('pendingUsername');
            localStorage.removeItem('pendingEmail');
          } catch (profileError) {
            console.error('Error creating profile:', profileError);
            const errorMsg = profileError.message || '';
            if (errorMsg.includes('Username already taken') || errorMsg.includes('already taken')) {
              setError('Username is already taken. Please choose a different username.');
            } else if (errorMsg.includes('Profile already exists')) {
              setError('Profile already exists. Please sign in instead.');
            } else {
              setError(errorMsg || 'Account created but profile setup failed. Please try signing in.');
            }
            setLoading(false);
            return;
          }
          onLogin();
        } else {
          localStorage.setItem('pendingUsername', trimmedUsername);
          localStorage.setItem('pendingEmail', email);
          setSuccess('Account created! Please check your email to confirm your account. Your profile will be created automatically after you confirm your email.');
        }
      } else {
        await authService.signIn(email, password);
        const pendingUsername = localStorage.getItem('pendingUsername');
        if (pendingUsername) {
          try {
            await createProfile({ username: pendingUsername });
            localStorage.removeItem('pendingUsername');
            localStorage.removeItem('pendingEmail');
          } catch (profileError) {
            console.error('Error creating profile after email confirmation:', profileError);
            const errorMsg = profileError.message || '';
            if (!errorMsg.includes('Profile already exists')) {
              console.warn('Profile creation failed after email confirmation:', errorMsg);
            } else {
              localStorage.removeItem('pendingUsername');
              localStorage.removeItem('pendingEmail');
            }
          }
        }
        onLogin();
      }
    } catch (err) {
      const errorMessage = err.message || 'Authentication failed';
      if (errorMessage.toLowerCase().includes('email not confirmed') ||
        errorMessage.toLowerCase().includes('email_not_confirmed') ||
        errorMessage.toLowerCase().includes('confirm your email')) {
        setError('Please confirm your email address before signing in. Check your inbox for the confirmation link, or use the resend option if needed.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-[#e0e0e0]">
      {/* Dot grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-[#1a1a1a] via-transparent to-[#1a1a1a]" />

      <Navigation />

      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-80px)] px-6 py-12">
        <div className="w-full max-w-md" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
          <div className="bg-[#1f2128] border border-white/[0.08] rounded-xl p-8 md:p-10 shadow-2xl shadow-black/40">
            <h1 className="text-2xl font-bold text-center mb-1">
              <span className="text-amber-400">Ordered</span>PM
            </h1>
            <h2 className="text-lg font-medium text-center mb-8 text-gray-400">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignUp && (
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-400 mb-1.5">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Choose a username"
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[#e0e0e0] placeholder-gray-600 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20 transition-all"
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[#e0e0e0] placeholder-gray-600 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20 transition-all"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={isSignUp ? "Min. 6 characters" : "Enter password"}
                  minLength={6}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[#e0e0e0] placeholder-gray-600 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20 transition-all"
                />
              </div>

              {isSignUp && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-400 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter password"
                    minLength={6}
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[#e0e0e0] placeholder-gray-600 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20 transition-all"
                  />
                </div>
              )}

              {success && (
                <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm">
                  {success}
                </div>
              )}
              {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-8 py-3.5 bg-amber-400 text-[#1a1a1a] font-semibold rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <p className="text-center mt-6 text-sm text-gray-500">
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                  setSuccess('');
                  setUsername('');
                  setConfirmPassword('');
                }}
                className="text-amber-400 hover:text-amber-300 font-medium"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;

