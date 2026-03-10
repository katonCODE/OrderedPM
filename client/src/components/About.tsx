import React from 'react';
import Navigation from './Navigation';

const About: React.FC = () => {
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

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-12 py-20 md:py-32">
        <div className="max-w-2xl" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-8 tracking-tight">
            About <span className="text-amber-400">OrderedPM</span>
          </h1>
          <div className="space-y-5 text-base md:text-lg text-gray-400 leading-relaxed">
            <p>
              This webapp is a passion project created by Daniel Huang, a student at AUT.
            </p>
            <p>
              The goal of this project is to create a simple and efficient project management tool that is easy to use and understand.
            </p>
            <p>
              It is built with React, Express.js, and PostgreSQL, and hosted on Vercel and Render.
            </p>
            <p>
              The project is still a work in progress and more features will be added in the future.
            </p>
            <p className="text-[#e0e0e0]">
              Thanks for checking it out :)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
