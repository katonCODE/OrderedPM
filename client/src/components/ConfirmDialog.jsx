// client/src/components/ConfirmDialog.jsx
import React, { useEffect, useRef } from 'react';
import './ConfirmDialog.css';

function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonClass = 'btn-danger',
  isLoading = false
}) {
  const confirmButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Focus the cancel button by default for safety
      cancelButtonRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, isLoading]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleConfirm = () => {
    if (!isLoading) {
      onConfirm();
    }
  };

  const handleCancel = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.2s_ease-out]"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div className="relative w-full max-w-md animate-[slideUp_0.2s_ease-out]">
        {/* Glassmorphism Card */}
        <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl">
          {/* Floating effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur opacity-50"></div>

          <div className="relative">
            <div className="px-6 pt-6 pb-4 border-b border-white/10">
              <h2 id="confirm-dialog-title" className="text-2xl font-semibold text-[#e0e0e0]">
                {title}
              </h2>
            </div>

            <div className="px-6 py-6">
              <p id="confirm-dialog-message" className="text-gray-400 leading-relaxed">
                {message}
              </p>
            </div>

            <div className="px-6 pb-6 pt-4 border-t border-white/10 flex gap-3 justify-end">
              <button
                ref={cancelButtonRef}
                onClick={handleCancel}
                className="px-6 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-[#e0e0e0] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
                aria-label={cancelText}
              >
                {cancelText}
              </button>
              <button
                ref={confirmButtonRef}
                onClick={handleConfirm}
                className={`px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${confirmButtonClass === 'btn-danger'
                    ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                    : 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a1a1a] hover:from-yellow-300 hover:to-yellow-400 shadow-lg shadow-yellow-500/20'
                  }`}
                disabled={isLoading}
                aria-label={confirmText}
              >
                {isLoading ? 'Processing...' : confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;

