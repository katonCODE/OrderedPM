// client/src/components/TaskCreationModal.jsx
import React from 'react';
import { createPortal } from 'react-dom';

function TaskCreationModal({ onSelectManual, onSelectAI, onClose }) {
  const modalContent = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="relative w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Glassmorphism Card */}
        <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl">
          {/* Floating effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur opacity-50"></div>

          <div className="relative">
            <h2 className="text-2xl font-bold text-[#e0e0e0] mb-2">Create New Task</h2>
            <p className="text-gray-400 mb-8 text-sm">Choose how you'd like to create your task</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <button
                type="button"
                onClick={onSelectManual}
                className="flex flex-col items-center p-8 bg-white/5 border-2 border-white/10 rounded-xl hover:border-blue-500/50 hover:bg-white/10 transition-all group"
              >
                <span className="text-5xl mb-3">✏️</span>
                <span className="text-xl font-semibold text-[#e0e0e0] mb-2">Manual</span>
                <span className="text-sm text-gray-400 text-center">Fill out the form yourself</span>
              </button>

              <button
                type="button"
                onClick={onSelectAI}
                className="flex flex-col items-center p-8 bg-white/5 border-2 border-white/10 rounded-xl hover:border-purple-500/50 hover:bg-white/10 transition-all group"
              >
                <span className="text-5xl mb-3">🤖</span>
                <span className="text-xl font-semibold text-[#e0e0e0] mb-2">AI</span>
                <span className="text-sm text-gray-400 text-center">Let AI generate task details</span>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-[#e0e0e0] font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default TaskCreationModal;

