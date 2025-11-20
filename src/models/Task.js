const { DataTypes, Op } = require('sequelize');
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
  start_date: {
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

// Hook: beforeCreate - Prepare and log task creation
Task.beforeCreate(async (task, options) => {
  try {
    const userId = options?.userId || task.created_by;
    
    if (!userId || !task.project_id) {
      return;
    }

    // Store task data for logging
    task._activityUserId = userId;
    task._shouldLogCreation = true;
    
    // Store task data for deferred logging (since ID is needed but not available yet)
    const taskData = {
      title: task.title,
      project_id: task.project_id,
      userId: userId,
      created_at: new Date()
    };
    
    // Defer logging until after the task is saved and has an ID
    // Use process.nextTick to ensure it runs after the current save operation
    process.nextTick(async () => {
      try {
        // Small delay to ensure the task has been saved to the database
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Find the task by matching title, project_id, and recent creation time
        const { Task: TaskModel } = require('./index');
        const savedTask = await TaskModel.findOne({
          where: {
            title: taskData.title,
            project_id: taskData.project_id,
            created_at: {
              [Op.gte]: new Date(Date.now() - 5000) // Within last 5 seconds
            }
          },
          order: [['createdAt', 'DESC']],
          limit: 1
        });
        
        if (savedTask && savedTask.id) {
          await taskActivityLogger.logTaskCreated(savedTask, taskData.userId);
        }
      } catch (error) {
        console.error('Failed to log task creation activity:', error);
      }
    });
  } catch (error) {
    // Log error but don't throw - activity logging shouldn't break the main operation
    console.error('Failed to prepare task creation activity log:', error);
  }
});

// Hook: beforeUpdate - Log task updates
Task.beforeUpdate(async (task, options) => {
  try {
    const userId = options?.userId;
    
    // Skip logging if no userId provided (might be a system update)
    if (!userId) {
      return;
    }

    // Skip if task doesn't have required fields
    if (!task.id || !task.project_id) {
      return;
    }

    // Get old values using Sequelize's previous() method
    const changedFields = task.changed() || [];
    if (changedFields.length === 0) {
      // No changes, skip logging
      return;
    }

    const oldValues = {};
    const newValues = {};
    
    // Build old and new value objects for changed fields
    changedFields.forEach(field => {
      oldValues[field] = task.previous(field);
      newValues[field] = task.dataValues[field];
    });

    // Track changes for key fields
    const fieldsToTrack = ['title', 'task_status_id', 'priority_label_id', 'assigned_to', 'due_date', 'description', 'completed'];
    
    // Use helper function to find changed set
    const { changes, oldValue, newValue } = findChangedSet(oldValues, newValues, fieldsToTrack);

    // Only log if there are actual changes in tracked fields
    if (changes.length > 0) {
      // Determine activity type and description using helper functions
      const activityType = determineActivityType(changes);
      const description = generateActivityDescription(changes);
      
      // Store logging data for deferred execution
      const logData = {
        taskId: task.id,
        projectId: task.project_id,
        activityType,
        description,
        updatedBy: userId,
        oldValue,
        newValue
      };
      
      // Log activity asynchronously (use setImmediate to ensure it doesn't block the update)
      setImmediate(async () => {
        try {
          await taskActivityLogger.logActivity(logData);
        } catch (error) {
          console.error('Failed to log task update activity:', error);
        }
      });
    }
  } catch (error) {
    // Log error but don't throw - activity logging shouldn't break the main operation
    console.error('Failed to prepare task update activity log:', error);
  }
});

module.exports = Task;


