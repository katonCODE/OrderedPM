// client/src/utils/export.js

export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvRows = [];

  csvRows.push(headers.join(','));

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    });
    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
};

export const exportToJSON = (data, filename) => {
  if (!data) {
    alert('No data to export');
    return;
  }

  try {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.json`);
    link.style.visibility = 'hidden';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('Error exporting JSON:', error);
    alert('Failed to export JSON. Please try again.');
  }
};

export const formatProjectsForExport = (projects, tasks) => {
  return projects.map(project => {
    const projectTasks = tasks.filter(t => t.project_id === project.id);
    return {
      'Project ID': project.id,
      'Project Name': project.name,
      'Project Description': project.description || '',
      'Project Created': project.created_at,
      'Project Updated': project.updated_at || project.created_at,
      'Total Tasks': projectTasks.length,
      'Completed Tasks': projectTasks.filter(t => t.status === 'done').length,
      'In Progress Tasks': projectTasks.filter(t => t.status === 'in_progress').length,
      'Todo Tasks': projectTasks.filter(t => t.status === 'todo').length,
    };
  });
};

export const formatTasksForExport = (tasks, projects) => {
  const projectMap = new Map(projects.map(p => [p.id, p.name]));

  return tasks.map(task => ({
    'Task ID': task.id,
    'Project Name': projectMap.get(task.project_id) || task.project_id,
    'Project ID': task.project_id,
    'Title': task.title,
    'Description': task.description || '',
    'Status': task.status,
    'Priority': task.priority || 'medium',
    'Due Date': task.due_date || '',
    'Created': task.created_at,
    'Updated': task.updated_at || task.created_at,
  }));
};

export const exportAllData = (projects, tasks, format = 'csv') => {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `orderedpm-export-${timestamp}`;

  if (format === 'json') {
    const exportData = {
      exported_at: new Date().toISOString(),
      projects: projects.map(p => ({
        ...p,
        tasks: tasks.filter(t => t.project_id === p.id),
      })),
    };
    exportToJSON(exportData, filename);
  } else {
    const projectsData = formatProjectsForExport(projects, tasks);
    const tasksData = formatTasksForExport(tasks, projects);

    exportToCSV(projectsData, `${filename}-projects`);
    if (tasksData.length > 0) {
      setTimeout(() => {
        exportToCSV(tasksData, `${filename}-tasks`);
      }, 100);
    }
  }
};

export const exportProjectData = (project, tasks, format = 'csv') => {
  if (!project) {
    alert('Project data not available');
    return;
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const sanitizedName = (project.name || 'project').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const filename = `project-${sanitizedName}-${timestamp}`;

  if (format === 'json') {
    try {
      const sanitizedProject = {
        id: project.id,
        name: project.name,
        description: project.description || null,
        created_at: project.created_at,
        updated_at: project.updated_at || project.created_at,
      };

      const sanitizedTasks = (tasks || []).map(task => ({
        id: task.id,
        project_id: task.project_id,
        title: task.title,
        description: task.description || null,
        status: task.status,
        priority: task.priority || 'medium',
        due_date: task.due_date || null,
        created_at: task.created_at,
        updated_at: task.updated_at || task.created_at,
      }));

      const exportData = {
        exported_at: new Date().toISOString(),
        project: {
          ...sanitizedProject,
          tasks: sanitizedTasks,
        },
      };
      exportToJSON(exportData, filename);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      alert('Failed to export JSON. Please try again.');
    }
  } else {
    const projectData = [{
      'Project ID': project.id,
      'Project Name': project.name,
      'Project Description': project.description || '',
      'Project Created': project.created_at,
      'Project Updated': project.updated_at || project.created_at,
    }];

    const tasksData = tasks.map(task => ({
      'Task ID': task.id,
      'Title': task.title,
      'Description': task.description || '',
      'Status': task.status,
      'Priority': task.priority || 'medium',
      'Due Date': task.due_date || '',
      'Created': task.created_at,
      'Updated': task.updated_at || task.created_at,
    }));

    exportToCSV(projectData, `${filename}-project`);
    if (tasksData.length > 0) {
      setTimeout(() => {
        exportToCSV(tasksData, `${filename}-tasks`);
      }, 100);
    }
  }
};
