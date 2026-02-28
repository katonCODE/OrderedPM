import React from 'react';
import Navigation from './Navigation';

const About: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-[#e0e0e0]">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 -right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Navigation Bar */}
      <Navigation />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-32">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              About
            </span>
          </h1>
          <div className="space-y-6 text-lg md:text-xl text-gray-400 leading-relaxed">
            <p>
              This webapp is a passion project created by Daniel Huang, a student at AUT.
            </p>
            <p>
              The goal of this project is to create a simple and efficient project management tool that is easy to use and understand.
              It is built with React, Express.js, and PostgreSQL.
            </p>
            <p>
              It is built with React, Express.js, and PostgreSQL.
              It is hosted on Vercel and Render.
            </p>
            <p>
              The project is still a work in progress and more features will be added in the future.
            </p>
            <p>
              Thanks for checking it out :)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
