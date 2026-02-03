// client/src/utils/import.js

export const parseJSONFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(data);
      } catch (error) {
        reject(new Error('Invalid JSON file format'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

export const parseCSVFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) {
          reject(new Error('CSV file is empty'));
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
          const values = [];
          let currentValue = '';
          let inQuotes = false;

          for (let j = 0; j < lines[i].length; j++) {
            const char = lines[i][j];
            if (char === '"') {
              if (inQuotes && lines[i][j + 1] === '"') {
                currentValue += '"';
                j++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              values.push(currentValue.trim());
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim());

          if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            rows.push(row);
          }
        }

        resolve({ headers, rows });
      } catch (error) {
        reject(new Error('Failed to parse CSV file: ' + error.message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

export const extractProjectsFromJSON = (data) => {
  if (!data) {
    throw new Error('Invalid data structure');
  }

  if (data.projects && Array.isArray(data.projects)) {
    return data.projects;
  } else if (data.project) {
    return [data.project];
  } else if (Array.isArray(data)) {
    return data;
  } else {
    throw new Error('Invalid JSON structure. Expected projects array or project object.');
  }
};

export const extractProjectsFromCSV = (csvData) => {
  const { rows } = csvData;
  const projects = [];

  rows.forEach(row => {
    const project = {
      name: row['Project Name'] || row['name'] || '',
      description: row['Project Description'] || row['description'] || null,
    };

    if (project.name) {
      projects.push(project);
    }
  });

  return projects;
};

export const extractTasksFromJSON = (data, projectId, projectName = null) => {
  if (!data) {
    return [];
  }

  let projects = [];
  if (data.projects && Array.isArray(data.projects)) {
    projects = data.projects;
  } else if (data.project) {
    projects = [data.project];
  } else if (Array.isArray(data)) {
    projects = data;
  }

  const allTasks = [];
  projects.forEach(project => {
    if (project.tasks && Array.isArray(project.tasks)) {
      project.tasks.forEach(task => {
        if (!projectName || project.name === projectName) {
          allTasks.push({
            ...task,
            project_id: projectId,
          });
        }
      });
    }
  });

  return allTasks;
};

export const extractTasksFromCSV = (csvData, projectId) => {
  const { rows } = csvData;
  const tasks = [];

  rows.forEach(row => {
    const task = {
      project_id: projectId,
      title: row['Title'] || row['title'] || '',
      description: row['Description'] || row['description'] || null,
      status: row['Status'] || row['status'] || 'todo',
      priority: row['Priority'] || row['priority'] || 'medium',
      due_date: row['Due Date'] || row['due_date'] || row['Due Date'] || null,
    };

    if (task.title) {
      if (!['todo', 'in_progress', 'done'].includes(task.status)) {
        task.status = 'todo';
      }
      if (!['low', 'medium', 'high'].includes(task.priority)) {
        task.priority = 'medium';
      }
      tasks.push(task);
    }
  });

  return tasks;
};

export const validateProjectData = (project) => {
  if (!project.name || project.name.trim() === '') {
    throw new Error('Project name is required');
  }
  return {
    name: project.name.trim(),
    description: project.description?.trim() || null,
  };
};

export const validateTaskData = (task) => {
  if (!task.title || task.title.trim() === '') {
    throw new Error('Task title is required');
  }
  return {
    project_id: task.project_id,
    title: task.title.trim(),
    description: task.description?.trim() || null,
    status: ['todo', 'in_progress', 'done'].includes(task.status) ? task.status : 'todo',
    priority: ['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'medium',
    due_date: task.due_date || null,
  };
};
