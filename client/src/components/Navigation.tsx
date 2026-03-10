import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === '/') {
      // For home, only match exact path (not /project, /u, etc.)
      return currentPath === '/';
    }
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  return (
    <nav className="relative z-10 px-6 py-5 md:px-12">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity">
          <span className="text-amber-400">Ordered</span>PM
        </Link>
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className={`text-sm font-medium transition-colors hidden md:inline-block ${
              isActive('/') ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Home
          </Link>
          <Link
            to="/about"
            className={`text-sm font-medium transition-colors hidden md:inline-block ${
              isActive('/about') ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            About
          </Link>
          <Link
            to="/login"
            className="px-5 py-2 text-sm font-semibold bg-white text-[#1a1a1a] rounded-lg hover:bg-gray-100 transition-colors"
          >
            Login
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
