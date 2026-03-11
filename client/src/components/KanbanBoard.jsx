// client/src/components/KanbanBoard.js
import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

function KanbanBoard({
  tasks,
  onStatusChange,
  onPositionChange,
  onEdit,
  onDelete,
  onTaskClick,
  selectedDate,
  searchQuery,
  selectedTag,
  selectedPriority,
  sortByPriority,
  canEdit = true,
  canDelete = true,
  canReorder = true
}) {
  const columns = [
    { id: 'todo', title: 'To Do', status: 'todo' },
    { id: 'in_progress', title: 'In Progress', status: 'in_progress' },
    { id: 'done', title: 'Done', status: 'done' },
  ];

  const getPriorityOrder = (priority) => {
    const order = { high: 1, medium: 2, low: 3 };
    return order[priority] || 4; // Default to end if priority is null/undefined
  };

  const getTitleFontSize = (title) => {
    if (!title) return 16;
    const length = title.length;
    // Scale from 18px (short) down to 12px (long), with caps
    // Formula: max(12, min(18, 18 - (length - 20) * 0.15))
    // This gives: 0-20 chars = 18px, 20-60 chars = scales down, 60+ chars = 12px minimum
    const maxSize = 18;
    const minSize = 12;
    const scalingStart = 20;
    const scalingFactor = 0.15;
    
    if (length <= scalingStart) {
      return maxSize;
    }
    
    const calculatedSize = maxSize - (length - scalingStart) * scalingFactor;
    return Math.max(minSize, Math.min(maxSize, calculatedSize));
  };

  const getTasksForColumn = (status) => {
    let filtered = tasks.filter(task => task.status === status);

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task => {
        const titleMatch = task.title?.toLowerCase().includes(query);
        const descriptionMatch = task.description?.toLowerCase().includes(query);
        return titleMatch || descriptionMatch;
      });
    }

    if (selectedDate) {
      filtered = filtered.filter(task => {
        if (!task.due_date) return false;
        const taskDate = new Date(task.due_date).toDateString();
        const selectedDateStr = new Date(selectedDate).toDateString();
        return taskDate === selectedDateStr;
      });
    }

    if (selectedTag) {
      filtered = filtered.filter(task =>
        task.tags && Array.isArray(task.tags) && task.tags.includes(selectedTag)
      );
    }

    if (selectedPriority) {
      filtered = filtered.filter(task => task.priority === selectedPriority);
    }

    // Sort by priority if enabled, then by position (nulls last), then by created_at
    filtered.sort((a, b) => {
      if (sortByPriority) {
        const priorityA = getPriorityOrder(a.priority);
        const priorityB = getPriorityOrder(b.priority);
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
      }

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
    if (!canReorder) return;
    const { destination, source, draggableId } = result;

    // Step 1: Early validation
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

    // Step 2: Determine move type
    const taskId = draggableId;
    const isSameColumn = destination.droppableId === source.droppableId;

    // Step 3: Get destination column tasks (conditional logic)
    let destColumnTasks;

    if (isSameColumn) {
      // Same-column move: dragged task is in the destination column
      // Get full destination column array (includes dragged task)
      const fullDestColumnTasks = getTasksForColumn(newStatus);

      // Verify dragged task exists in this array (safety check)
      const draggedTask = fullDestColumnTasks.find(t => String(t.id) === String(taskId));
      if (!draggedTask) return;

      // Create filtered array excluding the dragged task
      destColumnTasks = fullDestColumnTasks.filter(t => String(t.id) !== String(taskId));
    } else {
      // Cross-column move: dragged task is NOT in the destination column
      // Get destination column tasks directly (no filtering needed)
      destColumnTasks = getTasksForColumn(newStatus);
    }

    // Step 4: Calculate targetIndex
    // destination.index from @hello-pangea/dnd represents the final position in the reordered list.
    // This directly maps to the insertion point in destColumnTasks (which excludes the dragged task).
    // No adjustment is needed for either same-column or cross-column moves.
    let targetIndex = Math.max(0, Math.min(destination.index, destColumnTasks.length));

    // Step 5: Calculate prevPosition and nextPosition for fractional indexing
    let prevPosition = null;
    let nextPosition = null;

    if (destColumnTasks.length === 0) {
      // Empty column - both positions are null
      prevPosition = null;
      nextPosition = null;
    } else if (targetIndex === 0) {
      // Dropped at the top
      prevPosition = null;
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

    // Step 6: Call onPositionChange to update position and status
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

  const getCreatorName = (task) => task.creator_full_name || task.creator_username || 'Unknown';
  const getCreatorInitials = (task) => {
    const source = getCreatorName(task).trim();
    if (!source) return '?';
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  };

  const formatRecurrence = (task) => {
    if (!task?.recurrence_type) return null;
    const interval = task.recurrence_interval || 1;
    const label = task.recurrence_type.charAt(0).toUpperCase() + task.recurrence_type.slice(1);
    return interval > 1 ? `Every ${interval} ${label}` : `Every ${label}`;
  };

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[600px] w-full">
          {columns.map((column) => {
            const columnTasks = getTasksForColumn(column.status);

            return (
              <div key={column.id} className="dashboard-sketch-card dashboard-panel relative flex min-h-full flex-col p-4 transition-colors">
                <div className="mb-4 flex items-center justify-between border-b border-[#d4af37]/10 pb-3">
                  <h3 className="dashboard-geometric text-lg font-semibold text-[#d4af37]">{column.title}</h3>
                  <span className="dashboard-pill border border-[#d4af37]/20 bg-[#d4af37]/10 px-3 py-1 text-xs font-semibold text-[#f0d792]">
                    {columnTasks.length}
                  </span>
                </div>
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto min-h-0 pr-1 transition-all duration-200 ${snapshot.isDraggingOver
                        ? 'rounded-[14px] border-2 border-dashed border-[#d4af37]/50 bg-[rgba(212,175,55,0.08)] p-2'
                        : ''
                        }`}
                    >
                      {columnTasks.length === 0 ? (
                        <div className={`text-center text-sm py-8 transition-all ${snapshot.isDraggingOver
                          ? 'font-medium text-[#f0d792]'
                          : 'text-[#8f8779]'
                          }`}>
                          {snapshot.isDraggingOver ? 'Drop task here' : 'No tasks'}
                        </div>
                      ) : (
                        columnTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={String(task.id)} index={index} isDragDisabled={!canReorder}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...(canReorder ? provided.dragHandleProps : {})}
                                style={{
                                  ...provided.draggableProps.style,
                                  ...(snapshot.isDragging && {
                                    zIndex: 99999,
                                  }),
                                }}
                                className={`dashboard-sketch-card relative mb-3 rounded-[16px] p-4 transition-colors hover:bg-white/[0.05] ${snapshot.isDragging
                                  ? 'shadow-2xl'
                                  : ''
                                  } ${canReorder ? 'cursor-grab active:cursor-grabbing' : ''}`}
                              >
                                {canReorder && (
                                  <div
                                    className="pointer-events-none absolute left-2 top-2 flex h-6 w-6 items-center justify-center text-[#6f675b]"
                                    title="Drag to reorder"
                                  >
                                    ⋮⋮
                                  </div>
                                )}
                                <div
                                  onClick={(e) => {
                                    // Prevent task click if we're dragging
                                    if (snapshot.isDragging) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      return;
                                    }
                                    if (onTaskClick) {
                                      onTaskClick(task);
                                    }
                                  }}
                                  className={`cursor-pointer ${canReorder ? 'pl-8' : ''}`}
                                  style={{ pointerEvents: snapshot.isDragging ? 'none' : 'auto' }}
                                >
                                  <div className="flex justify-between items-start gap-2 mb-2">
                                    <div className="min-w-0 flex-1">
                                      <h4 
                                        className="dashboard-geometric leading-tight line-clamp-2 font-semibold text-[#efe5cf]" 
                                        style={{ fontSize: `${getTitleFontSize(task.title)}px` }}
                                        title={task.title}
                                      >
                                        {task.title}
                                      </h4>
                                    </div>
                                    {(canEdit || canDelete) && (
                                      <div className="flex gap-1 flex-shrink-0">
                                        {canEdit && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onEdit(task);
                                            }}
                                            className="dashboard-icon-button h-8 w-8 rounded-[10px] p-0 text-sm"
                                            title="Edit"
                                          >
                                            ✏️
                                          </button>
                                        )}
                                        {canDelete && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onDelete(task.id);
                                            }}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-red-400/20 bg-white/[0.03] text-sm text-[#c7ba9f] transition-colors hover:bg-red-500/10 hover:text-red-300"
                                            title="Delete"
                                          >
                                            🗑️
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {task.description && (
                                    <p className="mb-3 line-clamp-2 text-sm text-[#b9ae99]">{task.description}</p>
                                  )}
                                  {task.total_subtasks > 0 && (
                                    <div className="mb-3">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-[#b9ae99]">Subtasks</span>
                                        <span className="text-xs text-[#8f8779]">
                                          {task.completed_subtasks || 0}/{task.total_subtasks}
                                        </span>
                                      </div>
                                      <div className="dashboard-progress-track w-full">
                                        <div
                                          className="dashboard-progress-fill dashboard-progress-fill--marker h-1.5 transition-all duration-300"
                                          style={{
                                            width: `${((task.completed_subtasks || 0) / task.total_subtasks) * 100}%`,
                                            '--progress-hue': '44',
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {task.due_date && (
                                      <span className="text-xs text-[#8f8779]">
                                        Due {new Date(task.due_date).toLocaleDateString()}
                                      </span>
                                    )}
                                    {task.estimated_minutes && (
                                      <span className="rounded px-2 py-0.5 text-xs font-medium border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
                                        {task.estimated_minutes} min
                                      </span>
                                    )}
                                    {task.priority && (
                                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${task.priority === 'high'
                                        ? 'border border-red-400/20 bg-red-500/10 text-red-300'
                                        : task.priority === 'medium'
                                          ? 'border border-[#d4af37]/20 bg-[#d4af37]/10 text-[#f0d792]'
                                          : 'border border-slate-400/20 bg-slate-500/10 text-slate-300'
                                        }`}>
                                        {formatPriority(task.priority)}
                                      </span>
                                    )}
                                    {task.recurrence_type && (
                                      <span className="rounded border border-[#d4af37]/20 bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-[#d1c5af]">
                                        {formatRecurrence(task)}
                                      </span>
                                    )}
                                    {task.blocked_by_count > 0 && (
                                      <span className="rounded border border-orange-400/20 bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-300">
                                        Blocked by {task.blocked_by_count}
                                      </span>
                                    )}
                                    {task.blocking_count > 0 && (
                                      <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-[#b9ae99]">
                                        Blocking {task.blocking_count}
                                      </span>
                                    )}
                                  </div>
                                  {task.tags && Array.isArray(task.tags) && task.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {task.tags.slice(0, 3).map((tag, index) => (
                                        <span
                                          key={index}
                                          className="inline-block rounded border border-[#d4af37]/20 bg-[#d4af37]/10 px-2 py-0.5 text-xs text-[#f0d792]"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                      {task.tags.length > 3 && (
                                        <span className="inline-block rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-[#8f8779]">
                                          +{task.tags.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <div className="mt-3 flex items-center gap-2 border-t border-[#d4af37]/10 pt-2">
                                    {task.creator_avatar_url ? (
                                      <img
                                        src={task.creator_avatar_url}
                                        alt={getCreatorName(task)}
                                        className="h-5 w-5 rounded-full border border-[#d4af37]/20 object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#d4af37]/20 bg-white/[0.05] text-[10px] font-semibold text-[#d1c5af]">
                                        {getCreatorInitials(task)}
                                      </div>
                                    )}
                                    <span className="truncate text-xs text-[#b9ae99]">
                                      {getCreatorName(task)}
                                    </span>
                                  </div>
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
    </>
  );
}

export default KanbanBoard;

