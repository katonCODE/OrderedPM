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
    <nav className="relative z-10 px-6 py-4 md:px-12 md:py-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold text-[#e0e0e0] hover:text-white transition-colors">
          OrderedPM
        </Link>
        <div className="flex items-center gap-4 md:gap-6">
          <Link
            to="/"
            className={`text-sm md:text-base transition-all hidden md:inline-block ${isActive('/')
                ? 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] font-medium'
                : 'text-[#e0e0e0] hover:text-white'
              }`}
          >
            Home
          </Link>
          <Link
            to="/solutions"
            className={`text-sm md:text-base transition-all hidden md:inline-block ${isActive('/solutions')
                ? 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] font-medium'
                : 'text-[#e0e0e0] hover:text-white'
              }`}
          >
            Solutions
          </Link>
          <Link
            to="/login"
            className={`px-4 py-2 md:px-6 md:py-2.5 font-semibold rounded-lg transition-all text-sm md:text-base ${isActive('/login')
                ? 'bg-white text-[#1a1a1a] drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] shadow-lg'
                : 'bg-white text-[#1a1a1a] hover:bg-gray-200'
              }`}
          >
            Login
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
