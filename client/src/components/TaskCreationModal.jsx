// client/src/components/TaskCreationModal.jsx
import React from 'react';
import './TaskCreationModal.css';

function TaskCreationModal({ onSelectManual, onSelectAI, onClose }) {
  return (
    <div className="form-overlay" onClick={onClose}>
      <div className="form-card task-creation-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Create New Task</h2>
        <p className="modal-subtitle">Choose how you'd like to create your task</p>
        
        <div className="creation-options">
          <button 
            type="button" 
            onClick={onSelectManual} 
            className="creation-option-btn"
          >
            <span className="option-icon">✏️</span>
            <span className="option-title">Manual</span>
            <span className="option-description">Fill out the form yourself</span>
          </button>
          
          <button 
            type="button" 
            onClick={onSelectAI} 
            className="creation-option-btn"
          >
            <span className="option-icon">🤖</span>
            <span className="option-title">AI</span>
            <span className="option-description">Let AI generate task details</span>
          </button>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskCreationModal;

