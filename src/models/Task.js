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
    type: DataTypes.DECIMAL(20, 10),
    allowNull: false,
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

/**
 * Helper method to get the next position for a new task in a section
 * @param {number} sectionId - The section ID
 * @returns {Promise<number>} - The next position value
 */
Task.getNextPosition = async function(sectionId) {
  try {
    if (!sectionId) {
      console.warn('getNextPosition called with invalid sectionId:', sectionId);
      return 1.0;
    }

    const lastTask = await this.findOne({
      where: {
        section_id: sectionId,
        deleted_at: null
      },
      order: [['position', 'DESC']],
      attributes: ['position']
    });

    if (!lastTask || lastTask.position === null || lastTask.position === undefined) {
      // No tasks in section, start at position 1.0
      return 1.0;
    }

    // Convert to number if it's a string (Sequelize DECIMAL returns as string)
    const lastPosition = parseFloat(lastTask.position);
    if (isNaN(lastPosition)) {
      console.warn('Invalid position value found:', lastTask.position);
      return 1.0;
    }

    return lastPosition + 1.0;
  } catch (error) {
    console.error('Error getting next position:', error);
    return 1.0; // Default fallback
  }
};

/**
 * Helper method to calculate position between two positions
 * Used for inserting tasks between existing tasks
 * @param {number} beforePosition - Position before the insertion point (null if inserting at start)
 * @param {number} afterPosition - Position after the insertion point (null if inserting at end)
 * @returns {number} - The calculated position
 */
Task.calculatePositionBetween = function(beforePosition, afterPosition) {
  // Handle null/undefined values
  const before = (beforePosition !== null && beforePosition !== undefined) ? parseFloat(beforePosition) : null;
  const after = (afterPosition !== null && afterPosition !== undefined) ? parseFloat(afterPosition) : null;

  // Case 1: Inserting at the start (no task before, but there's a task after)
  if (before === null && after !== null) {
    // Insert before the first task - use half of the after position
    const afterPos = parseFloat(after);
    if (isNaN(afterPos)) {
      console.warn('Invalid afterPosition value:', afterPosition);
      return 0.5;
    }
    // Ensure we get a valid position between 0 and afterPos
    return afterPos > 0 ? afterPos / 2.0 : 0.5;
  }

  // Case 2: Inserting at the end (there's a task before, but no task after)
  if (before !== null && after === null) {
    // Insert after the last task - add 1.0 to the before position
    const beforePos = parseFloat(before);
    if (isNaN(beforePos)) {
      console.warn('Invalid beforePosition value:', beforePosition);
      return 1.0;
    }
    return beforePos + 1.0;
  }

  // Case 3: Inserting between two tasks (both before and after exist)
  if (before !== null && after !== null) {
    const beforePos = parseFloat(before);
    const afterPos = parseFloat(after);
    
    // Validate both positions are numbers
    if (isNaN(beforePos) || isNaN(afterPos)) {
      console.warn('Invalid position values:', { beforePosition, afterPosition });
      return beforePos && !isNaN(beforePos) ? beforePos + 1.0 : 1.0;
    }
    
    // Safety check: ensure after is greater than before
    if (afterPos <= beforePos) {
      console.warn('Invalid position range: after <= before', {
        beforePos,
        afterPos,
        difference: afterPos - beforePos
      });
      // If positions are equal or invalid, add 0.5 to before position
      return beforePos + 0.5;
    }
    
    // Calculate average position (midpoint)
    const avg = (beforePos + afterPos) / 2.0;
    
    // Validate the calculated average is between before and after
    if (avg <= beforePos || avg >= afterPos) {
      console.warn('Calculated average is not between positions, using fallback', {
        beforePos,
        afterPos,
        avg
      });
      return beforePos + 0.5;
    }
    
    // If positions are too close (less than 0.0001 apart), use fallback
    // This is a safety mechanism, but with DECIMAL(20, 10) we have plenty of precision
    if (Math.abs(afterPos - beforePos) < 0.0001) {
      console.warn('Positions too close, using fallback', {
        beforePos,
        afterPos,
        difference: Math.abs(afterPos - beforePos)
      });
      return beforePos + 0.5;
    }

    return avg;
  }

  // Case 4: No tasks in section (both are null) - start at position 1.0
  return 1.0;
};

module.exports = Task;


