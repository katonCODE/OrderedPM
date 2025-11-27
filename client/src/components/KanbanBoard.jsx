// client/src/components/KanbanBoard.js
import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './KanbanBoard.css';

function KanbanBoard({ tasks, onStatusChange, onEdit, onDelete, selectedDate }) {
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
    if (newStatus) {
      onStatusChange(draggableId, newStatus);
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

