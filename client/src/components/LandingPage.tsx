import React from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-[#e0e0e0]">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 -right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Navigation Bar */}
      <Navigation />

      {/* Hero Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Copy & Actions */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-full">
              <span className="text-sm font-medium text-blue-400">AI-Powered</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              Organize Your Work,{' '}
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Simplified
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-gray-400 leading-relaxed max-w-xl">
              AI-powered task creation with Gemini 2.5 Flash, intuitive Kanban boards,
              seamless project organization, and effortless team collaboration all in one place.
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/login"
                className="px-8 py-4 bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a1a1a] font-semibold rounded-lg hover:from-yellow-300 hover:to-yellow-400 transition-all shadow-lg shadow-yellow-500/20 text-center"
              >
                Get Started
              </Link>
            </div>

            {/* Trust Signal */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Free to Start • No Credit Card Required</span>
            </div>
          </div>

          {/* Right Column - Hero Visual */}
          <div className="relative">
            {/* Glassmorphism Card */}
            <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl">
              {/* Floating effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur opacity-50"></div>

              <div className="relative">
                {/* Project Dashboard Preview */}
                <div>
                  <h3 className="text-lg font-semibold text-[#e0e0e0] mb-4">Project Dashboard</h3>
                  
                  {/* Stats Overview */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="text-xs text-gray-400 mb-1">Total Projects</div>
                      <div className="text-2xl font-bold text-[#e0e0e0]">3</div>
                    </div>
                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="text-xs text-gray-400 mb-1">Active Tasks</div>
                      <div className="text-2xl font-bold text-blue-400">24</div>
                    </div>
                  </div>

                  {/* Project Cards Preview */}
                  <div className="space-y-3">
                    {/* Project Card 1 */}
                    <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-xl blur opacity-0 group-hover:opacity-50 transition-opacity"></div>
                      <div className="relative">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-base font-semibold text-[#e0e0e0]">Web App</h4>
                          <div className="flex gap-1.5">
                            <button className="p-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-[#e0e0e0] text-xs">✏️</button>
                            <button className="p-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-[#e0e0e0] text-xs">🗑️</button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-gray-400">Progress</span>
                              <span className="text-xs font-medium text-[#e0e0e0]">65%</span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-1.5">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full"
                                style={{ width: '65%' }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3 text-gray-400">
                              <span>12 tasks</span>
                              <span className="text-green-400">8 done</span>
                            </div>
                            <div className="text-gray-500">
                              Updated {new Date().toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Project Card 2 */}
                    <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-xl blur opacity-0 group-hover:opacity-50 transition-opacity"></div>
                      <div className="relative">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-base font-semibold text-[#e0e0e0]">Mobile App</h4>
                          <div className="flex gap-1.5">
                            <button className="p-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-[#e0e0e0] text-xs">✏️</button>
                            <button className="p-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-[#e0e0e0] text-xs">🗑️</button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-gray-400">Progress</span>
                              <span className="text-xs font-medium text-[#e0e0e0]">40%</span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-1.5">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full"
                                style={{ width: '40%' }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3 text-gray-400">
                              <span>8 tasks</span>
                              <span className="text-green-400">3 done</span>
                            </div>
                            <div className="text-gray-500">
                              Updated {new Date().toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
