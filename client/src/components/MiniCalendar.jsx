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
        return <div className="mx-auto mt-1 h-1 w-1 rounded-full bg-[#d4af37]" />;
      }
    }
    return null;
  };

  return (
    <div className="dashboard-sketch-card dashboard-panel relative rounded-[18px] p-4">
      <h3 className="dashboard-geometric mb-4 text-lg font-semibold text-[#d4af37]">Calendar</h3>
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
          border-bottom: 1px solid rgba(212, 175, 55, 0.1);
        }
        .react-calendar__navigation button {
          min-width: 44px;
          background: none;
          font-size: 16px;
          margin-top: 8px;
          color: #efe5cf;
          border: none;
          cursor: pointer;
        }
        .react-calendar__navigation button:enabled:hover,
        .react-calendar__navigation button:enabled:focus {
          background-color: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .react-calendar__navigation button[disabled] {
          color: #6f675b;
        }
        .react-calendar__month-view__weekdays {
          text-align: center;
          text-transform: uppercase;
          font-weight: 600;
          font-size: 0.75em;
          color: #8f8779;
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
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(222, 209, 175, 0.1);
          border-radius: 10px;
          padding: 0.75em 0.5em;
          text-align: center;
          color: #efe5cf;
          font-size: 0.833em;
          cursor: pointer;
        }
        .react-calendar__tile:enabled:hover,
        .react-calendar__tile:enabled:focus {
          background-color: rgba(255, 255, 255, 0.05);
        }
        .react-calendar__tile--now {
          background: rgba(212, 175, 55, 0.08);
          border-color: rgba(212, 175, 55, 0.2);
        }
        .react-calendar__tile--active {
          background: rgba(212, 175, 55, 0.14);
          border-color: rgba(212, 175, 55, 0.35);
        }
        .react-calendar__tile.has-tasks {
          border-color: rgba(212, 175, 55, 0.22);
        }
        .react-calendar__tile.selected-date {
          background: rgba(212, 175, 55, 0.14);
          border-color: rgba(212, 175, 55, 0.38);
          color: #f7ecd0;
        }
        .react-calendar__tile--neighboringMonth {
          color: #6f675b;
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
          className="dashboard-secondary-button mt-4 w-full px-4"
        >
          Clear Filter
        </button>
      )}
    </div>
  );
}

export default MiniCalendar;

