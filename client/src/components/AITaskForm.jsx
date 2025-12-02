// client/src/components/AITaskForm.jsx
import React, { useState } from 'react';
import { tasksAPI } from '../services/api';
import './TaskForm.css';

function AITaskForm({ projectId, onSubmit, onCancel }) {
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isGenerated, setIsGenerated] = useState(false);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setError('');
    setIsGenerating(true);

    try {
      const generatedData = await tasksAPI.generateTask(prompt, projectId);
      setTitle(generatedData.title || '');
      setDescription(generatedData.description || '');
      setPriority(generatedData.priority || 'medium');
      setIsGenerated(true);
    } catch (err) {
      setError(err.message || 'Failed to generate task. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Please generate a task first or enter a title');
      return;
    }

    if (!dueDate) {
      setError('Due date is required');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await onSubmit({
        project_id: projectId,
        title,
        description,
        status: 'todo',
        due_date: dueDate || null,
        start_date: startDate || null,
        priority,
      });
    } catch (err) {
      setError(err.message || 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="form-overlay">
      <div className="form-card">
        <h2>AI Task Creation</h2>
        
        <form onSubmit={handleSubmit}>
          {!isGenerated ? (
            <>
              <div className="form-group">
                <label htmlFor="ai-prompt">Describe your task *</label>
                <textarea
                  id="ai-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Create a login page with email and password fields"
                  rows={4}
                  required
                  disabled={isGenerating}
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="form-actions">
                <button type="button" onClick={onCancel} className="btn-secondary" disabled={isGenerating}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleGenerate} 
                  className="btn-primary" 
                  disabled={isGenerating || !prompt.trim()}
                >
                  {isGenerating ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="ai-title">Title *</label>
                <input
                  id="ai-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="ai-description">Description</label>
                <textarea
                  id="ai-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="ai-priority">Priority</label>
                <select
                  id="ai-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ai-start-date">Start Date</label>
                  <input
                    id="ai-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="ai-due-date">Due Date *</label>
                  <input
                    id="ai-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsGenerated(false);
                    setTitle('');
                    setDescription('');
                    setPriority('medium');
                    setDueDate('');
                    setStartDate('');
                    setPrompt('');
                    setError('');
                  }} 
                  className="btn-secondary" 
                  disabled={isSubmitting}
                >
                  Start Over
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

export default AITaskForm;

