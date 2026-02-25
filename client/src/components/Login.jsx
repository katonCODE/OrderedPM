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
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 -right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Navigation Bar */}
      <Navigation />

      {/* Login Card */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-80px)] px-6 py-12">
        <div className="relative w-full max-w-md">
          {/* Glassmorphism Card */}
          <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 md:p-10 shadow-2xl">
            {/* Floating effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur opacity-50"></div>

            <div className="relative">
              <h1 className="text-3xl md:text-4xl font-bold text-center mb-2">
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  OrderedPM
                </span>
              </h1>
              <h2 className="text-xl md:text-2xl font-semibold text-center mb-8 text-[#e0e0e0]">
                {isSignUp ? 'Create Your Account' : 'Sign In'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {isSignUp && (
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-400 mb-2">
                      Username *
                    </label>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      placeholder="Enter your username"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">
                    Email {isSignUp && '*'}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder={isSignUp ? "Enter your email address" : "your@email.com"}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-2">
                    Password {isSignUp && '*'}
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder={isSignUp ? "Enter your password (min. 6 characters)" : "Enter your password"}
                    minLength={6}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>

                {isSignUp && (
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-400 mb-2">
                      Confirm Password *
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Re-enter your password to confirm"
                      minLength={6}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    />
                  </div>
                )}

                {success && (
                  <div className="px-4 py-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
                    {success}
                  </div>
                )}
                {error && (
                  <div className="px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-8 py-4 bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a1a1a] font-semibold rounded-lg hover:from-yellow-300 hover:to-yellow-400 transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
                </button>
              </form>

              <p className="text-center mt-6 text-sm text-gray-400">
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
                  className="text-blue-400 hover:text-blue-300 underline font-medium"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;

