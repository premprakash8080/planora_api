const { TaskActivityLog } = require('../models');

/**
 * Utility to log task activities automatically
 */
const taskActivityLogger = {
  /**
   * Log task activity
   * @param {Object} params - Activity parameters
   * @param {number} params.taskId - Task ID
   * @param {number} params.projectId - Project ID
   * @param {string} params.activityType - Type of activity (created, updated, completed, assigned, etc.)
   * @param {string} params.description - Human-readable description
   * @param {number} params.updatedBy - User ID who performed the action
   * @param {Object} params.oldValue - Previous value (optional)
   * @param {Object} params.newValue - New value (optional)
   */
  async logActivity({ taskId, projectId, activityType, description, updatedBy, oldValue = null, newValue = null }) {
    try {
      await TaskActivityLog.create({
        task_id: taskId,
        project_id: projectId,
        activity_type: activityType,
        description,
        old_value: oldValue,
        new_value: newValue,
        updated_by: updatedBy
      });
    } catch (error) {
      // Log error but don't throw - activity logging shouldn't break the main operation
      console.error('Failed to log task activity:', error);
    }
  },

  /**
   * Log task creation
   */
  async logTaskCreated(task, userId) {
    await this.logActivity({
      taskId: task.id,
      projectId: task.project_id,
      activityType: 'created',
      description: `created task "${task.title}"`,
      updatedBy: userId
    });
  },

  /**
   * Log task update
   */
  async logTaskUpdated(task, updateData, userId) {
    const changes = [];
    const oldValue = {};
    const newValue = {};

    // Track what changed
    if (updateData.title !== undefined && updateData.title !== task.title) {
      changes.push('title');
      oldValue.title = task.title;
      newValue.title = updateData.title;
    }
    if (updateData.status !== undefined && updateData.status !== task.status) {
      changes.push('status');
      oldValue.status = task.status;
      newValue.status = updateData.status;
    }
    if (updateData.priority !== undefined && updateData.priority !== task.priority) {
      changes.push('priority');
      oldValue.priority = task.priority;
      newValue.priority = updateData.priority;
    }
    if (updateData.assigned_to !== undefined && updateData.assigned_to !== task.assigned_to) {
      changes.push('assigned_to');
      oldValue.assigned_to = task.assigned_to;
      newValue.assigned_to = updateData.assigned_to;
    }
    if (updateData.due_date !== undefined && updateData.due_date !== task.due_date) {
      changes.push('due_date');
      oldValue.due_date = task.due_date;
      newValue.due_date = updateData.due_date;
    }

    if (changes.length > 0) {
      const description = `updated ${changes.join(', ')}`;
      await this.logActivity({
        taskId: task.id,
        projectId: task.project_id,
        activityType: changes.length === 1 && changes[0] === 'status' ? 'status_changed' : 'updated',
        description,
        updatedBy: userId,
        oldValue: Object.keys(oldValue).length > 0 ? oldValue : null,
        newValue: Object.keys(newValue).length > 0 ? newValue : null
      });
    }
  },

  /**
   * Log task completion
   */
  async logTaskCompleted(task, userId) {
    await this.logActivity({
      taskId: task.id,
      projectId: task.project_id,
      activityType: 'completed',
      description: `marked task "${task.title}" as completed`,
      updatedBy: userId,
      oldValue: { completed: false },
      newValue: { completed: true }
    });
  },

  /**
   * Log task assignment
   */
  async logTaskAssigned(task, assignedToUserId, userId) {
    const { User } = require('../models');
    const assignedUser = await User.findByPk(assignedToUserId, { attributes: ['full_name'] });
    const userName = assignedUser ? assignedUser.full_name : 'Unknown User';
    
    await this.logActivity({
      taskId: task.id,
      projectId: task.project_id,
      activityType: 'assigned',
      description: `assigned task "${task.title}" to ${userName}`,
      updatedBy: userId,
      oldValue: { assigned_to: task.assigned_to },
      newValue: { assigned_to: assignedToUserId }
    });
  },

  /**
   * Log task comment
   */
  async logTaskComment(task, comment, userId) {
    await this.logActivity({
      taskId: task.id,
      projectId: task.project_id,
      activityType: 'comment',
      description: `added a comment`,
      updatedBy: userId
    });
  }
};

module.exports = taskActivityLogger;

