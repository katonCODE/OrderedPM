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
              seamless project organization, and effortless team collaboration—all in one place.
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/login"
                className="px-8 py-4 bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a1a1a] font-semibold rounded-lg hover:from-yellow-300 hover:to-yellow-400 transition-all shadow-lg shadow-yellow-500/20 text-center"
              >
                Get Started
              </Link>
              <button className="px-8 py-4 border-2 border-gray-600 text-[#e0e0e0] font-semibold rounded-lg hover:border-gray-500 hover:text-white transition-all flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                Watch Demo
              </button>
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
                {/* Mini Kanban Board Preview */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-[#e0e0e0] mb-4">Project Dashboard</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {/* To Do Column */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        To Do
                      </div>
                      <div className="bg-white/10 rounded-lg p-3 border border-white/10">
                        <div className="text-sm font-medium text-[#e0e0e0] mb-1">Design mockups</div>
                        <div className="text-xs text-gray-500">Due tomorrow</div>
                      </div>
                      <div className="bg-white/10 rounded-lg p-3 border border-white/10">
                        <div className="text-sm font-medium text-[#e0e0e0] mb-1">Review PR</div>
                        <div className="text-xs text-gray-500">High priority</div>
                      </div>
                    </div>

                    {/* In Progress Column */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        In Progress
                      </div>
                      <div className="bg-blue-500/20 rounded-lg p-3 border border-blue-500/30">
                        <div className="text-sm font-medium text-[#e0e0e0] mb-1">Build API</div>
                        <div className="text-xs text-gray-500">In progress</div>
                      </div>
                      <div className="bg-white/10 rounded-lg p-3 border border-white/10">
                        <div className="text-sm font-medium text-[#e0e0e0] mb-1">Write docs</div>
                        <div className="text-xs text-gray-500">2 days left</div>
                      </div>
                    </div>

                    {/* Done Column */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Done
                      </div>
                      <div className="bg-green-500/20 rounded-lg p-3 border border-green-500/30 opacity-60">
                        <div className="text-sm font-medium text-[#e0e0e0] mb-1 line-through">Setup project</div>
                        <div className="text-xs text-gray-500">Completed</div>
                      </div>
                      <div className="bg-green-500/20 rounded-lg p-3 border border-green-500/30 opacity-60">
                        <div className="text-sm font-medium text-[#e0e0e0] mb-1 line-through">Team meeting</div>
                        <div className="text-xs text-gray-500">Completed</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Project Cards Preview */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mb-2"></div>
                    <div className="text-sm font-medium text-[#e0e0e0] mb-1">Web App</div>
                    <div className="text-xs text-gray-500">12 tasks</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="w-3 h-3 bg-purple-500 rounded-full mb-2"></div>
                    <div className="text-sm font-medium text-[#e0e0e0] mb-1">Mobile</div>
                    <div className="text-xs text-gray-500">8 tasks</div>
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
