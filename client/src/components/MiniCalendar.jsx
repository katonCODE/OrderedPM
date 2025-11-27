// client/src/components/MiniCalendar.js
import React, { useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './MiniCalendar.css';

function MiniCalendar({ tasks, onDateClick, selectedDate }) {
  const datesWithTasks = useMemo(() => {
    const dates = new Set();
    tasks.forEach(task => {
      if (task.due_date) {
        const date = new Date(task.due_date);
        date.setHours(0, 0, 0, 0);
        dates.add(date.getTime());
      }
    });
    return dates;
  }, [tasks]);

  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const dateTime = new Date(date);
      dateTime.setHours(0, 0, 0, 0);
      const dateTimestamp = dateTime.getTime();
      
      if (datesWithTasks.has(dateTimestamp)) {
        return 'has-tasks';
      }
      if (selectedDate) {
        const selectedTime = new Date(selectedDate);
        selectedTime.setHours(0, 0, 0, 0);
        if (dateTimestamp === selectedTime.getTime()) {
          return 'selected-date';
        }
      }
    }
    return null;
  };

  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const dateTime = new Date(date);
      dateTime.setHours(0, 0, 0, 0);
      if (datesWithTasks.has(dateTime.getTime())) {
        return <div className="task-dot" />;
      }
    }
    return null;
  };

  return (
    <div className="mini-calendar">
      <h3>Calendar</h3>
      <Calendar
        onChange={onDateClick}
        value={selectedDate}
        tileClassName={tileClassName}
        tileContent={tileContent}
        className="react-calendar-custom"
      />
      {selectedDate && (
        <button
          onClick={() => onDateClick(null)}
          className="clear-date-filter"
        >
          Clear Filter
        </button>
      )}
    </div>
  );
}

export default MiniCalendar;

