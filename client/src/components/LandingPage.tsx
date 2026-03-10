import React from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';

const features = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
      </svg>
    ),
    title: 'AI-Powered Planning',
    desc: 'Gemini 2.5 Flash generates optimized daily task plans based on your priorities, deadlines, and time budget.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
      </svg>
    ),
    title: 'Kanban & Timeline',
    desc: 'Drag-and-drop boards, timeline views, and flexible task organization to manage projects your way.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
    title: 'Team Collaboration',
    desc: 'Share projects with granular permissions — admin, editor, or viewer access via simple share links.',
  },
];

const tasks = [
  { title: 'Design system updates', status: 'In Progress', statusColor: 'text-amber-400', done: false, active: true },
  { title: 'API integration', status: 'Done', statusColor: 'text-emerald-400', done: true, active: false },
  { title: 'User testing', status: 'To Do', statusColor: 'text-gray-500', done: false, active: false },
];

const stats = [
  { label: 'Projects', value: '3', color: 'text-[#e0e0e0]' },
  { label: 'Active', value: '24', color: 'text-blue-400' },
  { label: 'Done', value: '87%', color: 'text-emerald-400' },
];

const trustSignals = ['Free forever', 'No credit card', 'AI-powered'];

const LandingPage: React.FC = () => {
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

      {/* Hero */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-12 pt-12 md:pt-24 pb-16 md:pb-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Column */}
          <div className="space-y-7" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm font-medium text-amber-400">AI-Powered</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight">
              Ship projects{' '}
              <span className="text-amber-400">faster.</span>
            </h1>

            <p className="text-base sm:text-lg text-gray-400 leading-relaxed max-w-lg">
              AI task planning with Gemini 2.5 Flash, intuitive Kanban boards,
              and seamless team collaboration — all in one clean workspace.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Link
                to="/login"
                className="px-7 py-3.5 bg-amber-400 text-[#1a1a1a] font-semibold rounded-lg hover:bg-amber-300 transition-colors text-center shadow-lg shadow-amber-400/10"
              >
                Get Started Free
              </Link>
              <Link
                to="/about"
                className="px-7 py-3.5 bg-white/5 border border-white/10 font-medium rounded-lg hover:bg-white/10 transition-colors text-center"
              >
                Learn More
              </Link>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
              {trustSignals.map((text) => (
                <span key={text} className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {text}
                </span>
              ))}
            </div>
          </div>

          {/* Right Column - Dashboard Preview */}
          <div className="relative" style={{ animation: 'fadeInUp 0.5s ease-out 0.15s both' }}>
            <div className="bg-[#1f2128] border border-white/[0.08] rounded-xl p-5 md:p-6 shadow-2xl shadow-black/40">
              {/* Window chrome */}
              <div className="flex items-center gap-2 mb-5 pb-4 border-b border-white/[0.06]">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-xs text-gray-500 font-mono">orderedpm / dashboard</span>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {stats.map((stat) => (
                  <div key={stat.label} className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{stat.label}</div>
                    <div className={`text-lg font-bold font-mono ${stat.color}`}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Task list */}
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div key={task.title} className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      task.done ? 'border-emerald-400 bg-emerald-400/20' : task.active ? 'border-amber-400' : 'border-gray-600'
                    }`}>
                      {task.done && (
                        <svg className="w-2.5 h-2.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm flex-1 ${task.done ? 'text-gray-500 line-through' : ''}`}>{task.title}</span>
                    <span className={`text-xs font-medium ${task.statusColor}`}>{task.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-12 pb-20 md:pb-32">
        <div className="grid md:grid-cols-3 gap-5">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 bg-white/[0.03] border border-white/[0.08] rounded-xl hover:bg-white/[0.05] transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 mb-4">
                {feature.icon}
              </div>
              <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
