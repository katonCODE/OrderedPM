// client/src/components/KanbanBoard.js
import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './KanbanBoard.css';

function KanbanBoard({ tasks, onStatusChange, onPositionChange, onEdit, onDelete, selectedDate }) {
  const columns = [
    { id: 'todo', title: 'To Do', status: 'todo' },
    { id: 'in_progress', title: 'In Progress', status: 'in_progress' },
    { id: 'done', title: 'Done', status: 'done' },
  ];

  const getTasksForColumn = (status) => {
    let filtered = tasks.filter(task => task.status === status);
    
    if (selectedDate) {
      filtered = filtered.filter(task => {
        if (!task.due_date) return false;
        const taskDate = new Date(task.due_date).toDateString();
        const selectedDateStr = new Date(selectedDate).toDateString();
        return taskDate === selectedDateStr;
      });
    }
    
    // Sort by position (nulls last), then by created_at
    filtered.sort((a, b) => {
      const posA = a.position ?? Infinity;
      const posB = b.position ?? Infinity;
      if (posA !== posB) {
        return posA - posB;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
    
    return filtered;
  };

  const handleDragEnd = (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const statusMap = {
      'todo': 'todo',
      'in_progress': 'in_progress',
      'done': 'done',
    };

    const newStatus = statusMap[destination.droppableId];
    const oldStatus = statusMap[source.droppableId];
    
    if (!newStatus) return;

    const taskId = draggableId;
    const isSameColumn = destination.droppableId === source.droppableId;
    
    // Get tasks for destination column, excluding the dragged task
    // This ensures we only use destination column positions for cross-column moves
    const destColumnTasks = getTasksForColumn(newStatus).filter(t => t.id !== taskId);
    
    // Calculate prevPosition and nextPosition for fractional indexing
    let prevPosition = null;
    let nextPosition = null;
    
    // Adjust index for same-column moves
    let targetIndex = destination.index;
    if (isSameColumn && source.index < destination.index) {
      // Moving down: adjust index since task is removed from above
      targetIndex = destination.index - 1;
    }
    
    // Ensure targetIndex is within valid bounds
    targetIndex = Math.max(0, Math.min(targetIndex, destColumnTasks.length));
    
    if (destColumnTasks.length === 0) {
      // Empty column - both positions are null
      prevPosition = null;
      nextPosition = null;
    } else if (targetIndex === 0) {
      // Dropped at the top
      prevPosition = null;
      // Use actual position if available, otherwise use a default that's less than typical starting position
      const firstTaskPos = destColumnTasks[0].position;
      nextPosition = firstTaskPos !== null && firstTaskPos !== undefined ? firstTaskPos : 10000;
    } else if (targetIndex >= destColumnTasks.length) {
      // Dropped at the bottom
      const lastTask = destColumnTasks[destColumnTasks.length - 1];
      const lastTaskPos = lastTask.position;
      prevPosition = lastTaskPos !== null && lastTaskPos !== undefined ? lastTaskPos : (10000 + (destColumnTasks.length * 1000));
      nextPosition = null;
    } else {
      // Dropped between two tasks
      const taskBefore = destColumnTasks[targetIndex - 1];
      const taskAfter = destColumnTasks[targetIndex];
      
      const beforePos = taskBefore.position;
      const afterPos = taskAfter.position;
      
      // If both have positions, use them
      if (beforePos !== null && beforePos !== undefined && afterPos !== null && afterPos !== undefined) {
        prevPosition = beforePos;
        nextPosition = afterPos;
      } else {
        // If one or both are null, use index-based defaults
        prevPosition = beforePos !== null && beforePos !== undefined ? beforePos : (10000 + ((targetIndex - 1) * 1000));
        nextPosition = afterPos !== null && afterPos !== undefined ? afterPos : (10000 + (targetIndex * 1000));
      }
    }
    
    // Update position and status
    // For cross-column moves, always ensure status is updated
    if (onPositionChange) {
      try {
        // For cross-column moves: always pass newStatus to update status
        // For same-column moves: pass undefined to keep current status
        const statusToUpdate = isSameColumn ? undefined : newStatus;
        onPositionChange(taskId, prevPosition, nextPosition, statusToUpdate);
      } catch (error) {
        console.error('Error in onPositionChange:', error);
        // Fallback: update status separately if position change fails for cross-column moves
        if (!isSameColumn && newStatus !== oldStatus && onStatusChange) {
          onStatusChange(taskId, newStatus);
        }
      }
    } else {
      // Fallback: if onPositionChange not available, update status for cross-column moves
      if (!isSameColumn && newStatus !== oldStatus && onStatusChange) {
        onStatusChange(taskId, newStatus);
      }
    }
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      case 'low':
        return 'priority-low';
      default:
        return 'priority-medium';
    }
  };

  const formatPriority = (priority) => {
    if (!priority) return 'Medium';
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {columns.map((column) => {
          const columnTasks = getTasksForColumn(column.status);
          
          return (
            <div key={column.id} className="kanban-column">
              <div className="kanban-column-header">
                <h3>{column.title}</h3>
                <span className="kanban-column-count">{columnTasks.length}</span>
              </div>
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`kanban-column-content ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                  >
                    {columnTasks.length === 0 ? (
                      <div className="kanban-empty-state">No tasks</div>
                    ) : (
                      columnTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`kanban-task-card ${snapshot.isDragging ? 'dragging' : ''}`}
                            >
                              <div className="kanban-task-header">
                                <h4>{task.title}</h4>
                                <div className="kanban-task-actions">
                                  <button
                                    onClick={() => onEdit(task)}
                                    className="btn-icon"
                                    title="Edit"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => onDelete(task.id)}
                                    className="btn-icon btn-danger"
                                    title="Delete"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                              {task.description && (
                                <p className="kanban-task-description">{task.description}</p>
                              )}
                              <div className="kanban-task-meta">
                                {task.due_date && (
                                  <span className="kanban-task-due-date">
                                    Due {new Date(task.due_date).toLocaleDateString()}
                                  </span>
                                )}
                                {task.priority && (
                                  <span className={`priority-badge ${getPriorityClass(task.priority)}`}>
                                    {formatPriority(task.priority)}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}

export default KanbanBoard;

