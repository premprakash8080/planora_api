const { DataTypes } = require('sequelize');
const database = require('../config/database');
const taskActivityLogger = require('../utils/taskActivityLogger');
const { findChangedSet, determineActivityType, generateActivityDescription } = require('../utils/taskHelpers');

const Task = database.define('Task', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  project_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  section_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  assigned_to: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  priority_label_id: {
    type: DataTypes.BIGINT,
    allowNull: true, // Will be set to a default PriorityLabel if null
  },
  task_status_id: {
    type: DataTypes.BIGINT,
    allowNull: true, // Will be set to a default TaskStatus if null
  },
  completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  due_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  comments_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // Note: parent_id commented out - column doesn't exist in database yet
  // parent_id: {
  //   type: DataTypes.BIGINT,
  //   allowNull: true,
  // },
  deleted_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'tasks',
  timestamps: true,
  underscored: true,
  paranoid: true,
  deletedAt: 'deleted_at',
});

// Hook: beforeCreate - Log task creation
Task.beforeCreate(async (task, options) => {
  // Store the userId in instance for afterCreate hook
  // We'll use created_by field which is already set
  task._activityUserId = options?.userId || task.created_by;
});

// Hook: afterCreate - Create activity log for task creation
Task.afterCreate(async (task, options) => {
  try {
    const userId = options?.userId || task.created_by || task._activityUserId;
    if (userId && task.id && task.project_id) {
      await taskActivityLogger.logTaskCreated(task, userId);
    }
  } catch (error) {
    // Log error but don't throw - activity logging shouldn't break the main operation
    console.error('Failed to log task creation activity:', error);
  }
});

// Hook: beforeUpdate - Store old values and userId for activity logging
Task.beforeUpdate(async (task, options) => {
  // Store old values for comparison using Sequelize's previous() method
  const changedFields = task.changed() || [];
  task._oldValues = {};
  changedFields.forEach(field => {
    task._oldValues[field] = task.previous(field);
  });
  // Store userId from options if provided
  task._activityUserId = options?.userId;
});

// Hook: afterUpdate - Create activity log for task updates
Task.afterUpdate(async (task, options) => {
  try {
    const userId = options?.userId || task._activityUserId;
    if (!userId) {
      // If no userId provided, skip logging (might be a system update)
      return;
    }

    if (!task.id || !task.project_id) {
      return;
    }

    // Get old values that were stored in beforeUpdate
    const oldValues = task._oldValues || {};
    const newValues = task.dataValues || {};

    // Track changes for key fields
    const fieldsToTrack = ['title', 'task_status_id', 'priority_label_id', 'assigned_to', 'due_date', 'description', 'completed'];
    
    // Use helper function to find changed set
    const { changes, oldValue, newValue } = findChangedSet(oldValues, newValues, fieldsToTrack);

    // Only log if there are actual changes
    if (changes.length > 0) {
      // Determine activity type and description using helper functions
      const activityType = determineActivityType(changes);
      const description = generateActivityDescription(changes);
      
      await taskActivityLogger.logActivity({
        taskId: task.id,
        projectId: task.project_id,
        activityType,
        description,
        updatedBy: userId,
        oldValue,
        newValue
      });
    }
  } catch (error) {
    // Log error but don't throw - activity logging shouldn't break the main operation
    console.error('Failed to log task update activity:', error);
  }
});

module.exports = Task;


