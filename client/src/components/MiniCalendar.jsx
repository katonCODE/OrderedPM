// client/src/components/MiniCalendar.js
import React, { useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

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

      let classes = [];
      if (datesWithTasks.has(dateTimestamp)) {
        classes.push('has-tasks');
      }
      if (selectedDate) {
        const selectedTime = new Date(selectedDate);
        selectedTime.setHours(0, 0, 0, 0);
        if (dateTimestamp === selectedTime.getTime()) {
          classes.push('selected-date');
        }
      }
      return classes.join(' ');
    }
    return null;
  };

  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const dateTime = new Date(date);
      dateTime.setHours(0, 0, 0, 0);
      if (datesWithTasks.has(dateTime.getTime())) {
        return <div className="w-1 h-1 bg-blue-400 rounded-full mx-auto mt-1" />;
      }
    }
    return null;
  };

  return (
    <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-[#e0e0e0] mb-4">Calendar</h3>
      <style>{`
        .react-calendar-custom {
          width: 100%;
          background: transparent;
          border: none;
          font-family: inherit;
        }
        .react-calendar__navigation {
          display: flex;
          height: 44px;
          margin-bottom: 1em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .react-calendar__navigation button {
          min-width: 44px;
          background: none;
          font-size: 16px;
          margin-top: 8px;
          color: #e0e0e0;
          border: none;
          cursor: pointer;
        }
        .react-calendar__navigation button:enabled:hover,
        .react-calendar__navigation button:enabled:focus {
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .react-calendar__navigation button[disabled] {
          color: #505050;
        }
        .react-calendar__month-view__weekdays {
          text-align: center;
          text-transform: uppercase;
          font-weight: 600;
          font-size: 0.75em;
          color: #b0b0b0;
          margin-bottom: 0.5em;
        }
        .react-calendar__month-view__weekdays__weekday {
          padding: 0.5em;
        }
        .react-calendar__month-view__days {
          display: grid !important;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }
        .react-calendar__tile {
          max-width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          padding: 0.75em 0.5em;
          text-align: center;
          color: #e0e0e0;
          font-size: 0.833em;
          cursor: pointer;
        }
        .react-calendar__tile:enabled:hover,
        .react-calendar__tile:enabled:focus {
          background-color: rgba(255, 255, 255, 0.1);
        }
        .react-calendar__tile--now {
          background: rgba(74, 158, 255, 0.2);
          border-color: rgba(74, 158, 255, 0.3);
        }
        .react-calendar__tile--active {
          background: rgba(74, 158, 255, 0.3);
          border-color: rgba(74, 158, 255, 0.5);
        }
        .react-calendar__tile.has-tasks {
          border-color: rgba(74, 158, 255, 0.4);
        }
        .react-calendar__tile.selected-date {
          background: rgba(74, 158, 255, 0.4);
          border-color: rgba(74, 158, 255, 0.6);
        }
        .react-calendar__tile--neighboringMonth {
          color: #666;
        }
      `}</style>
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
          className="mt-4 w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm text-[#e0e0e0] font-medium"
        >
          Clear Filter
        </button>
      )}
    </div>
  );
}

export default MiniCalendar;

