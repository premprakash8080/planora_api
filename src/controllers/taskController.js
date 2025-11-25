const { Task, Section, Project, User, TaskComment, Subtask, TaskStatus, PriorityLabel } = require('../models');
const { Op, Sequelize } = require('sequelize');
const taskActivityLogger = require('../utils/taskActivityLogger');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { formatTaskDate, formatTaskDateTime, formatTaskRelativeTime } = require('../utils/taskHelpers');

const taskController = () => {
  // Get my tasks
  const getMyTasks = async (req, res) => {
    try {
      const userId = req.user.id;
      
      if (!userId) {
        return res.status(401).json(errorResponse('User not authenticated', 401));
      }

      const tasks = await Task.findAll({
        where: { 
          assigned_to: userId, 
          deleted_at: null 
        },
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
          { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
          { model: TaskStatus, as: 'taskStatus', required: false },
          { model: PriorityLabel, as: 'priorityLabel', required: false },
          { model: Project, as: 'project', attributes: ['id', 'name', 'color'] },
        ],
        order: [
          // MySQL-compatible NULLS LAST: ISNULL(Task.due_date) puts NULLs last (1 > 0)
          [Sequelize.literal('ISNULL(`Task`.`due_date`)'), 'ASC'],
          [Sequelize.literal('`Task`.`due_date`'), 'ASC'],
          [Sequelize.literal('`Task`.`position`'), 'ASC'],
          [Sequelize.literal('`Task`.`created_at`'), 'DESC']
        ],
      });

      res.json(successResponse({ tasks }));
    } catch (error) {
      console.error('Error fetching my tasks:', error);
      res.status(500).json(errorResponse('Failed to fetch my tasks', 500));
    }
  };
  // Get all tasks for a project
  const getTasksByProject = async (req, res) => {
    // Support both projectId from params and from body
    const { projectId, project_id } = req.body;
    const projectIdValue = projectId || project_id || req.params.projectId;

    try {
      if (!projectIdValue || isNaN(parseInt(projectIdValue))) {
        return res.status(400).json(errorResponse('Missing params: project_id is required', 400));
      }

      const tasks = await Task.findAll({
        where: { project_id: parseInt(projectIdValue), deleted_at: null }, // Note: parent_id column doesn't exist in database
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
          { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
          { model: TaskStatus, as: 'taskStatus', required: false },
          { model: PriorityLabel, as: 'priorityLabel', required: false },
          // Note: childTasks removed - parent_id column doesn't exist in database
        ],
        order: [['position', 'ASC']],
      });
      res.json(successResponse({ tasks }));
    } catch (error) {
      res.status(500).json(errorResponse('Failed to fetch tasks', 500));
    }
  };

  // Get task by ID
  const getTaskById = async (req, res) => {
    // Support both taskId from params and from body
    const { taskId, task_id } = req.body;
    const taskIdValue = taskId || task_id || req.params.taskId;

    try {
      if (!taskIdValue || isNaN(parseInt(taskIdValue))) {
        return res.status(400).json(errorResponse('Missing params: task_id is required', 400));
      }

      const task = await Task.findByPk(taskIdValue, {
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
          { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
          { model: Project, as: 'project' },
          { model: TaskStatus, as: 'taskStatus', required: false },
          { model: PriorityLabel, as: 'priorityLabel', required: false },
          { 
            model: Subtask, 
            as: 'subtasks', 
            required: false,
            include: [
              { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false }
            ]
          },
          // Note: childTasks removed - parent_id column doesn't exist in database
          { model: TaskComment, as: 'comments', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'] }], required: false, order: [['created_at', 'ASC']] },
        ],
      });
      if (!task) {
        return res.status(404).json(errorResponse('Task not found', 404));
      }
      res.json(successResponse({ task }));
    } catch (error) {
      res.status(500).json(errorResponse('Failed to fetch task', 500));
    }
  };

  // Create new task
  const createTask = async (req, res) => {
    const { project_id, section_id, title, description, assigned_to, priority_label_id, task_status_id, start_date, due_date, position } = req.body;
    const created_by = req.user.id;

    try {
      if (!project_id || isNaN(parseInt(project_id))) {
        return res.status(400).json(errorResponse('Missing params: project_id is required', 400));
      }

      if (!title || title.trim().length === 0) {
        return res.status(400).json(errorResponse('Missing params: title is required', 400));
      }

      if (title && title.length > 255) {
        return res.status(400).json(errorResponse('Task title must be 255 characters or less', 400));
      }

      // Validate priority_label_id if provided
      if (priority_label_id !== undefined && priority_label_id !== null) {
        if (isNaN(parseInt(priority_label_id))) {
          return res.status(400).json(errorResponse('Invalid priority_label_id', 400));
        }
      }

      // Validate task_status_id if provided
      if (task_status_id !== undefined && task_status_id !== null) {
        if (isNaN(parseInt(task_status_id))) {
          return res.status(400).json(errorResponse('Invalid task_status_id', 400));
        }
      }

      // Auto-assign position if not provided
      let taskPosition = position;
      if (taskPosition === undefined || taskPosition === null) {
        // Get the next position for the section
        taskPosition = await Task.getNextPosition(section_id);
      } else {
        // Validate position is a valid number
        taskPosition = parseFloat(taskPosition);
        if (isNaN(taskPosition)) {
          taskPosition = await Task.getNextPosition(section_id);
        }
      }

      const task = await Task.create({
        project_id,
        section_id,
        title: title || 'New Task',
        description,
        created_by,
        assigned_to: assigned_to || null,
        priority_label_id: priority_label_id ? parseInt(priority_label_id) : null,
        task_status_id: task_status_id ? parseInt(task_status_id) : null,
        start_date: start_date || null,
        due_date: due_date || null,
        position: taskPosition,
        completed: false,
        // Note: parent_id removed - column doesn't exist in database
      }, {
        userId: created_by // Pass userId through options for activity log hook
      });

      const taskWithRelations = await Task.findByPk(task.id, {
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
          { model: TaskStatus, as: 'taskStatus', required: false },
          { model: PriorityLabel, as: 'priorityLabel', required: false },
          { model: TaskComment, as: 'comments', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'avatar_url'] }], required: false },
          // Note: childTasks removed - parent_id column doesn't exist in database
        ],
      });

      // Activity log is now handled by the model hook (afterCreate)
      // Keeping this for backward compatibility, but it will be a duplicate log
      // Commented out to avoid duplicate logs:
      // await taskActivityLogger.logTaskCreated(taskWithRelations, created_by);

      res.status(201).json(successResponse({ task: taskWithRelations }, 'Task created successfully'));
    } catch (error) {
      res.status(500).json(errorResponse('Failed to create task', 500));
    }
  };

  // Update task
  const updateTask = async (req, res) => {
    // Support both taskId from params and from body
    const taskId = req.params.taskId || req.body.task_id;

    try {
      if (!taskId || isNaN(parseInt(taskId))) {
        return res.status(400).json(errorResponse('Missing params: task_id is required', 400));
      }

      // Extract update data, excluding task_id from body
      // Only include fields that are explicitly provided (not undefined)
      const { task_id, ...allBodyData } = req.body;
      const updateData = {};
      
      // Only copy fields that are explicitly provided (not undefined)
      // This ensures we don't accidentally update fields that weren't meant to be changed
      const allowedFields = [
        'title', 'description', 'assigned_to', 'start_date', 'due_date', 'completed',
        'priority_label_id', 'task_status_id', 'section_id', 'position'
      ];
      
      allowedFields.forEach(field => {
        if (allBodyData[field] !== undefined) {
          updateData[field] = allBodyData[field];
        }
      });

      if (updateData.title !== undefined && (!updateData.title || updateData.title.trim().length === 0)) {
        return res.status(400).json(errorResponse('Task title cannot be empty', 400));
      }

      if (updateData.title && updateData.title.length > 255) {
        return res.status(400).json(errorResponse('Task title must be 255 characters or less', 400));
      }

      // Validate priority_label_id if provided (allow null to unset)
      if (updateData.priority_label_id !== undefined) {
        if (updateData.priority_label_id === null || updateData.priority_label_id === '') {
          updateData.priority_label_id = null;
        } else {
          const parsed = parseInt(updateData.priority_label_id);
          if (isNaN(parsed)) {
            return res.status(400).json(errorResponse('Invalid priority_label_id', 400));
          }
          updateData.priority_label_id = parsed;
        }
      }

      // Validate task_status_id if provided (allow null to unset)
      if (updateData.task_status_id !== undefined) {
        if (updateData.task_status_id === null || updateData.task_status_id === '') {
          updateData.task_status_id = null;
        } else {
          const parsed = parseInt(updateData.task_status_id);
          if (isNaN(parsed)) {
            return res.status(400).json(errorResponse('Invalid task_status_id', 400));
          }
          updateData.task_status_id = parsed;
        }
      }

      // Validate position if provided (must be a valid decimal number)
      if (updateData.position !== undefined) {
        const parsed = parseFloat(updateData.position);
        if (isNaN(parsed)) {
          return res.status(400).json(errorResponse('Invalid position value', 400));
        }
        updateData.position = parsed;
      }

      const task = await Task.findByPk(taskId);
      if (!task) {
        return res.status(404).json(errorResponse('Task not found', 404));
      }

      // Store old values for activity logging (for backward compatibility)
      const oldTask = { ...task.toJSON() };

      await task.update(updateData, {
        userId: req.user.id // Pass userId through options for activity log hook
      });

      const updatedTask = await Task.findByPk(taskId, {
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
          { model: TaskStatus, as: 'taskStatus', required: false },
          { model: PriorityLabel, as: 'priorityLabel', required: false },
          { model: TaskComment, as: 'comments', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'avatar_url'] }], required: false },
          // Note: childTasks removed - parent_id column doesn't exist in database
        ],
      });

      // Activity log is now handled by the model hook (afterUpdate)
      // Keeping this for backward compatibility, but it will be a duplicate log
      // Commented out to avoid duplicate logs:
      // await taskActivityLogger.logTaskUpdated(oldTask, updateData, req.user.id);

      res.json(successResponse({ task: updatedTask }, 'Task updated successfully'));
    } catch (error) {
      res.status(500).json(errorResponse('Failed to update task', 500));
    }
  };

  // Delete task (soft delete)
  const deleteTask = async (req, res) => {
    // Support both taskId from params and from body
    const { taskId, task_id } = req.body;
    const taskIdValue = taskId || task_id || req.params.taskId;

    try {
      if (!taskIdValue || isNaN(parseInt(taskIdValue))) {
        return res.status(400).json(errorResponse('Missing params: task_id is required', 400));
      }

      const task = await Task.findByPk(taskIdValue);
      if (!task) {
        return res.status(404).json(errorResponse('Task not found', 404));
      }

      await task.destroy();
      res.json(successResponse(null, 'Task deleted successfully'));
    } catch (error) {
      console.error('Error deleting task:', error);
      res.status(500).json(errorResponse(`Failed to delete task: ${error.message}`, 500));
    }
  };

  // Toggle task completion
  const toggleTaskCompletion = async (req, res) => {
    const { taskId } = req.params;

    try {
      if (!taskId || isNaN(parseInt(taskId))) {
        return res.status(400).json(errorResponse('Invalid task ID', 400));
      }

      const task = await Task.findByPk(taskId);
      if (!task) {
        return res.status(404).json(errorResponse('Task not found', 404));
      }

      const wasCompleted = task.completed;
      await task.update({ completed: !task.completed }, {
        userId: req.user.id // Pass userId through options for activity log hook
      });

      // Activity log is now handled by the model hook (afterUpdate)
      // The hook will detect the 'completed' change and log it appropriately
      // Keeping this for backward compatibility, but it will be a duplicate log:
      // if (!wasCompleted) {
      //   await taskActivityLogger.logTaskCompleted(task, req.user.id);
      // }

      res.json(successResponse({ task }, 'Task completion toggled'));
    } catch (error) {
      res.status(500).json(errorResponse('Failed to toggle task completion', 500));
    }
  };

  // Get task dashboard details (task status upcoming, overdue, in progress, done) count


  // Batch update tasks (for drag-and-drop reordering, etc.)
  const batchUpdateTasks = async (req, res) => {
    try {
      const { updates } = req.body; // Array of { id, updates } objects

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json(errorResponse('Invalid updates array', 400));
      }

      const results = await Promise.all(
        updates.map(async ({ id, ...updateData }) => {
          const task = await Task.findByPk(id);
          if (task) {
            // For batch updates, pass userId if available (for activity logging)
            // If no userId, hooks will skip activity logging
            await task.update(updateData, {
              userId: req.user?.id // Pass userId through options for activity log hook
            });
            return { id, success: true };
          }
          return { id, success: false, error: 'Task not found' };
        })
      );

      res.json(successResponse({ results }, 'Tasks updated successfully'));
    } catch (error) {
      res.status(500).json(errorResponse('Failed to batch update tasks', 500));
    }
  };

  // Reorder tasks in a section (for drag-and-drop within same section)
  const reorderTasksInSection = async (req, res) => {
    try {
      const { section_id, task_positions } = req.body; // Array of { task_id, position }

      if (!section_id || isNaN(parseInt(section_id))) {
        return res.status(400).json(errorResponse('Missing or invalid section_id', 400));
      }

      if (!Array.isArray(task_positions) || task_positions.length === 0) {
        return res.status(400).json(errorResponse('Invalid task_positions array', 400));
      }

      // Calculate decimal positions for proper ordering
      // If positions are provided, use them; otherwise calculate based on order
      const positions = task_positions.map((item, index) => {
        if (item.position !== undefined && item.position !== null) {
          return parseFloat(item.position);
        }
        // Default: assign sequential positions starting from 1.0
        return (index + 1) * 1.0;
      });

      // Update positions for all tasks in the section
      const updatePromises = task_positions.map(async ({ task_id }, index) => {
        const task = await Task.findByPk(task_id);
        if (task && task.section_id === parseInt(section_id)) {
          const newPosition = positions[index];
          await task.update({ position: newPosition }, {
            userId: req.user?.id
          });
          return { task_id, success: true, position: newPosition };
        }
        return { task_id, success: false, error: 'Task not found or not in section' };
      });

      const results = await Promise.all(updatePromises);

      res.json(successResponse({ results }, 'Tasks reordered successfully'));
    } catch (error) {
      console.error('Error reordering tasks:', error);
      res.status(500).json(errorResponse('Failed to reorder tasks', 500));
    }
  };

  // Move task to different section (for drag-and-drop between sections)
  const moveTaskToSection = async (req, res) => {
    try {
      const { task_id, new_section_id, position } = req.body;

      if (!task_id || isNaN(parseInt(task_id))) {
        return res.status(400).json(errorResponse('Missing or invalid task_id', 400));
      }

      if (!new_section_id || isNaN(parseInt(new_section_id))) {
        return res.status(400).json(errorResponse('Missing or invalid new_section_id', 400));
      }

      const task = await Task.findByPk(task_id);
      if (!task) {
        return res.status(404).json(errorResponse('Task not found', 404));
      }

      // Calculate position based on before/after task or provided position
      let newPosition;
      if (position !== undefined && position !== null) {
        newPosition = parseFloat(position);
      } else {
        // Default: add to end of section
        newPosition = await Task.getNextPosition(parseInt(new_section_id));
      }

      // Update task section and position
      // All other properties (title, description, assigned_to, priority_label_id, 
      // task_status_id, start_date, due_date, completed) are preserved
      await task.update({
        section_id: parseInt(new_section_id),
        position: newPosition
      }, {
        userId: req.user?.id
      });

      // If task was moved from another section, we may want to reorder tasks in the old section
      // This is optional - you can add logic here if needed

      const updatedTask = await Task.findByPk(task_id, {
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
          { model: TaskStatus, as: 'taskStatus', required: false },
          { model: PriorityLabel, as: 'priorityLabel', required: false },
        ],
      });

      res.json(successResponse({ task: updatedTask }, 'Task moved successfully'));
    } catch (error) {
      console.error('Error moving task:', error);
      res.status(500).json(errorResponse('Failed to move task', 500));
    }
  };

  // Move task with before/after task support (Asana-style drag & drop)
  const moveTask = async (req, res) => {
    try {
      // Get taskId and other parameters from request body only
      const { taskId, sectionId, beforeTaskId, afterTaskId } = req.body;

      if (!taskId || isNaN(parseInt(taskId))) {
        return res.status(400).json(errorResponse('Missing or invalid task ID', 400));
      }

      const task = await Task.findByPk(taskId);
      if (!task) {
        return res.status(404).json(errorResponse('Task not found', 404));
      }

      // CRITICAL: Ensure we're only moving tasks within the same project
      // Get the target section to verify it belongs to the same project
      const targetSectionId = sectionId !== undefined && sectionId !== null 
        ? parseInt(sectionId) 
        : task.section_id;
      
      if (isNaN(targetSectionId) || targetSectionId === null) {
        return res.status(400).json(errorResponse('Invalid sectionId', 400));
      }

      // Verify target section exists and belongs to the same project as the task
      const targetSection = await Section.findByPk(targetSectionId);
      if (!targetSection) {
        return res.status(404).json(errorResponse('Target section not found', 404));
      }
      
      if (targetSection.project_id !== task.project_id) {
        return res.status(400).json(errorResponse('Cannot move task to a section in a different project', 400));
      }

      // Calculate new position using beforeTaskId/afterTaskId
      let newPosition;
      let beforePosition = null;
      let afterPosition = null;

      // Validate that beforeTaskId and afterTaskId are not both provided
      if (beforeTaskId && afterTaskId) {
        return res.status(400).json(errorResponse('Cannot provide both beforeTaskId and afterTaskId', 400));
      }

      if (beforeTaskId) {
        // Insert before this task (beforeTaskId will be after our inserted task)
        const beforeTask = await Task.findByPk(beforeTaskId);
        if (!beforeTask) {
          return res.status(404).json(errorResponse('Before task not found', 404));
        }
        if (beforeTask.section_id !== targetSectionId) {
          return res.status(400).json(errorResponse('Before task is not in target section', 400));
        }
        
        // Prevent moving task before itself
        if (parseInt(beforeTaskId) === parseInt(taskId)) {
          return res.status(400).json(errorResponse('Cannot move task before itself', 400));
        }
        
        // The beforeTask's position will be the afterPosition (it comes after our task)
        afterPosition = parseFloat(beforeTask.position) || 0;
        
        // Get task before the beforeTask (if exists) - this will be before our inserted task
        // Exclude both the task being moved AND the beforeTask itself
        // This query finds the task with the highest position that is still less than beforeTask's position
        // CRITICAL: When reordering within same section, we must exclude the task's current position
        // by excluding its ID, which we already do via Op.notIn
        // Also ensure we only look at tasks in the same project and section
        const excludeIds = [parseInt(taskId), parseInt(beforeTaskId)];
        const taskBeforeBefore = await Task.findOne({
          where: {
            section_id: targetSectionId,
            project_id: task.project_id, // Ensure same project
            deleted_at: null,
            id: { 
              [Op.notIn]: excludeIds
            },
            position: { [Op.lt]: afterPosition }
          },
          order: [['position', 'DESC']],
          attributes: ['position']
        });
        
        // If no task found before, beforePosition is null (inserting at start)
        beforePosition = taskBeforeBefore ? parseFloat(taskBeforeBefore.position) : null;
        newPosition = Task.calculatePositionBetween(beforePosition, afterPosition);
        
        console.log(`Calculating position with beforeTaskId ${beforeTaskId}:`, {
          taskId: parseInt(taskId),
          beforeTaskId: parseInt(beforeTaskId),
          taskCurrentPosition: task.position,
          taskCurrentSection: task.section_id,
          targetSectionId: targetSectionId,
          beforeTaskPosition: afterPosition,
          taskBeforeBeforePosition: beforePosition,
          calculatedPosition: newPosition,
          isSameSection: task.section_id === targetSectionId,
          excludeIds
        });
      } else if (afterTaskId) {
        // Insert after this task (afterTaskId will be before our inserted task)
        const afterTask = await Task.findByPk(afterTaskId);
        if (!afterTask) {
          return res.status(404).json(errorResponse('After task not found', 404));
        }
        if (afterTask.section_id !== targetSectionId) {
          return res.status(400).json(errorResponse('After task is not in target section', 400));
        }
        
        // Prevent moving task after itself
        if (parseInt(afterTaskId) === parseInt(taskId)) {
          return res.status(400).json(errorResponse('Cannot move task after itself', 400));
        }
        
        // The afterTask's position will be the beforePosition (it comes before our task)
        beforePosition = parseFloat(afterTask.position) || 0;
        
        // Get task after the afterTask (if exists) - this will be after our inserted task
        // Exclude both the task being moved AND the afterTask itself
        // This query finds the task with the lowest position that is still greater than afterTask's position
        // CRITICAL: When reordering within same section, we must exclude the task's current position
        // by excluding its ID, which we already do via Op.notIn
        // Also ensure we only look at tasks in the same project and section
        const excludeIds = [parseInt(taskId), parseInt(afterTaskId)];
        const taskAfterAfter = await Task.findOne({
          where: {
            section_id: targetSectionId,
            project_id: task.project_id, // Ensure same project
            deleted_at: null,
            id: { 
              [Op.notIn]: excludeIds
            },
            position: { [Op.gt]: beforePosition }
          },
          order: [['position', 'ASC']],
          attributes: ['position']
        });
        
        // If no task found after, afterPosition is null (inserting at end)
        afterPosition = taskAfterAfter ? parseFloat(taskAfterAfter.position) : null;
        newPosition = Task.calculatePositionBetween(beforePosition, afterPosition);
        
        console.log(`Calculating position with afterTaskId ${afterTaskId}:`, {
          taskId: parseInt(taskId),
          afterTaskId: parseInt(afterTaskId),
          taskCurrentPosition: task.position,
          taskCurrentSection: task.section_id,
          targetSectionId: targetSectionId,
          afterTaskPosition: beforePosition,
          taskAfterAfterPosition: afterPosition,
          calculatedPosition: newPosition,
          isSameSection: task.section_id === targetSectionId,
          excludeIds
        });
      } else {
        // No before/after specified - append to end of section
        // If moving to a different section, get next position in that section
        // If same section, get next position (which will be after all existing tasks)
        newPosition = await Task.getNextPosition(targetSectionId);
        console.log(`Appending task ${taskId} to end of section ${targetSectionId} at position ${newPosition}`);
      }

      // Validate the calculated position is a valid number
      if (isNaN(newPosition) || newPosition === null || newPosition === undefined) {
        console.error('Invalid calculated position:', newPosition);
        return res.status(500).json(errorResponse('Failed to calculate valid position', 500));
      }

      // Ensure position is positive
      if (newPosition <= 0) {
        console.warn('Calculated position is not positive, using fallback:', newPosition);
        newPosition = 1.0;
      }

      // Normalize position to float
      newPosition = parseFloat(newPosition);

      // Check if this is a same-section reorder
      const isCrossSectionMove = targetSectionId !== task.section_id;
      const currentPosition = parseFloat(task.position) || 0;

      // Update task section and position
      // All other properties are preserved
      const updateData = {
        position: newPosition
      };

      // Always update section_id if it's different (for cross-section moves)
      // This ensures the task is moved to the correct section
      if (isCrossSectionMove) {
        updateData.section_id = targetSectionId;
        console.log(`Moving task ${taskId} from section ${task.section_id} to section ${targetSectionId} at position ${newPosition}`);
      } else {
        // For same-section moves, ensure we update the position
        // This is important for reordering within the same section
        // Even if the position appears similar, we update it to ensure consistency
        console.log(`Reordering task ${taskId} within section ${targetSectionId} from position ${currentPosition} to position ${newPosition}`);
        
        // Log if position hasn't changed significantly (shouldn't happen with fractional indexing)
        if (Math.abs(newPosition - currentPosition) < 0.0001) {
          console.warn(`Warning: Position change is very small for same-section reorder: ${currentPosition} -> ${newPosition}`);
        }
      }

      // Perform the update
      // Sequelize instance.update() returns the updated instance
      await task.update(updateData, {
        userId: req.user?.id
      });

      // Reload the task to ensure we have the latest data
      await task.reload();

      const updatedTask = await Task.findByPk(taskId, {
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
          { model: TaskStatus, as: 'taskStatus', required: false },
          { model: PriorityLabel, as: 'priorityLabel', required: false },
        ],
      });

      res.json(successResponse({ task: updatedTask }, 'Task moved successfully'));
    } catch (error) {
      console.error('Error moving task:', error);
      res.status(500).json(errorResponse('Failed to move task', 500));
    }
  };

  // Helper function to get date formatters
  const getDateFormatters = (req) => {
    const timezone = req.app?.locals?.timezone || process.env.APP_TIMEZONE || 'UTC';
    return {
      timezone,
      formatDate: req.formatDate || ((date, format = 'DD MMM YY') => formatTaskDate(date, format, timezone)),
      formatDateTime: req.formatDateTime || ((date, format = 'YYYY-MM-DD HH:mm:ss') => formatTaskDateTime(date, format, timezone)),
      formatRelativeTime: req.formatRelativeTime || ((date) => formatTaskRelativeTime(date, timezone)),
    };
  };

  // Format calendar task for my-tasks
  const formatMyTasksCalendarTask = (task, formatters) => {
    if (!task) {
      return null;
    }

    const plain = task.toJSON ? task.toJSON() : task;
    const assignee = plain.assignee || null;
    const startDateValue = plain.start_date || plain.startDate || plain.due_date || plain.created_at || null;
    const dueDateValue = plain.due_date || plain.dueDate || startDateValue;
    const projectColor = plain.project?.color || '#3b82f6';
    const initials = assignee?.initials
      || (assignee?.full_name
        ? assignee.full_name
            .split(' ')
            .map(part => part.charAt(0))
            .join('')
            .substring(0, 2)
            .toUpperCase()
        : null);

    return {
      id: plain.id?.toString(),
      title: plain.title,
      completed: !!plain.completed,
      startDate: startDateValue ? formatters.formatDateTime(startDateValue, 'YYYY-MM-DD') : null,
      dueDate: dueDateValue ? formatters.formatDateTime(dueDateValue, 'YYYY-MM-DD') : null,
      startDateDisplay: startDateValue ? formatters.formatDate(startDateValue, 'MMM D, YYYY') : null,
      dueDateDisplay: dueDateValue ? formatters.formatDate(dueDateValue, 'MMM D, YYYY') : null,
      dueDateRelative: dueDateValue ? formatters.formatRelativeTime(dueDateValue) : null,
      assigneeName: assignee?.full_name || null,
      assigneeInitials: initials,
      assigneeColor: assignee?.avatar_color || null,
      userAvatar: assignee?.avatar_url || null,
      projectId: plain.project_id ? plain.project_id.toString() : null,
      projectName: plain.project?.name || 'Uncategorized',
      projectColor: projectColor,
      sectionId: plain.section_id ? plain.section_id.toString() : null,
      sectionName: plain.section?.name || 'Uncategorized',
    };
  };

  // Format board view task for my-tasks
  const formatMyTasksBoardViewTask = (task, formatters) => {
    if (!task) {
      return null;
    }
    const plain = task.toJSON ? task.toJSON() : task;
    const startDate = plain.start_date || plain.startDate || null;
    const dueDate = plain.due_date || plain.dueDate || null;
    const assignee = plain.assignee || null;
    const priorityLabel = plain.priorityLabel || null;
    const taskStatus = plain.taskStatus || null;

    const initials = assignee?.initials
      || (assignee?.full_name
        ? assignee.full_name
            .split(' ')
            .map(part => part.charAt(0))
            .join('')
            .substring(0, 2)
            .toUpperCase()
        : null);

    return {
      id: plain.id?.toString(),
      sectionId: plain.section_id ? plain.section_id.toString() : null,
      title: plain.title,
      description: plain.description || '',
      completed: !!plain.completed,
      order: typeof plain.position === 'number' ? plain.position : 0,
      startDate,
      startDateDisplay: startDate ? formatters.formatDate(startDate, 'MMM D, YYYY') : null,
      dueDate,
      dueDateDisplay: dueDate ? formatters.formatDate(dueDate, 'MMM D, YYYY') : null,
      dueDateRelative: dueDate ? formatters.formatRelativeTime(dueDate) : null,
      assigneeName: assignee?.full_name || null,
      assigneeInitials: initials,
      assigneeColor: assignee?.avatar_color || null,
      userAvatar: assignee?.avatar_url || null,
      priorityLabel: priorityLabel
        ? {
            id: priorityLabel.id?.toString(),
            name: priorityLabel.name,
            color: priorityLabel.color || null,
          }
        : null,
      status: taskStatus
        ? {
            id: taskStatus.id?.toString(),
            name: taskStatus.name,
            color: taskStatus.color || null,
          }
        : null,
      projectId: plain.project_id ? plain.project_id.toString() : null,
      projectName: plain.project?.name || 'Uncategorized',
      projectColor: plain.project?.color || '#3b82f6',
    };
  };

  // Get my tasks calendar view data
  const getMyTasksCalendarViewData = async (req, res) => {
    try {
      const userId = req.user.id;
      
      if (!userId) {
        return res.status(401).json(errorResponse('User not authenticated', 401));
      }

      const formatters = getDateFormatters(req);

      const tasks = await Task.findAll({
        where: { 
          assigned_to: userId, 
          deleted_at: null 
        },
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
          { model: TaskStatus, as: 'taskStatus', required: false },
          { model: PriorityLabel, as: 'priorityLabel', required: false },
          { model: Project, as: 'project', attributes: ['id', 'name', 'color'] },
        ],
        order: [
          [Sequelize.literal('ISNULL(`Task`.`due_date`)'), 'ASC'],
          [Sequelize.literal('`Task`.`due_date`'), 'ASC'],
          [Sequelize.literal('`Task`.`start_date`'), 'ASC'],
          [Sequelize.literal('`Task`.`updated_at`'), 'DESC'],
        ],
      });

      const calendarTasks = tasks
        .map(task => formatMyTasksCalendarTask(task, formatters))
        .filter(Boolean);

      return res.json(successResponse({
        project: {
          id: 'my-tasks',
          name: 'My Tasks',
          color: null,
        },
        tasks: calendarTasks,
      }));
    } catch (error) {
      console.error('Error fetching my tasks calendar view data:', error);
      return res.status(500).json(errorResponse('Failed to fetch my tasks calendar data', 500));
    }
  };

  // Get my tasks board view data
  const getMyTasksBoardViewData = async (req, res) => {
    try {
      const userId = req.user.id;
      
      if (!userId) {
        return res.status(401).json(errorResponse('User not authenticated', 401));
      }

      const formatters = getDateFormatters(req);

      // Get all tasks assigned to user
      const tasks = await Task.findAll({
        where: { 
          assigned_to: userId, 
          deleted_at: null 
        },
        include: [
          { model: Section, as: 'section' },
          { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'], required: false },
          { model: TaskStatus, as: 'taskStatus', required: false },
          { model: PriorityLabel, as: 'priorityLabel', required: false },
          { model: Project, as: 'project', attributes: ['id', 'name', 'color'] },
        ],
        order: [
          [Sequelize.literal('`Task`.`position`'), 'ASC'],
          [Sequelize.literal('`Task`.`updated_at`'), 'ASC'],
        ],
      });

      // Group tasks by section (across all projects)
      const sectionMap = new Map();
      
      tasks.forEach(task => {
        const plain = task.toJSON ? task.toJSON() : task;
        const sectionId = plain.section_id ? plain.section_id.toString() : 'uncategorized';
        const sectionName = plain.section?.name || 'Uncategorized';
        const projectName = plain.project?.name || 'Uncategorized';
        
        // Create section key: project_section or just section
        const sectionKey = `${plain.project_id || 'uncategorized'}_${sectionId}`;
        
        if (!sectionMap.has(sectionKey)) {
          sectionMap.set(sectionKey, {
            id: sectionKey,
            title: `${projectName} - ${sectionName}`,
            order: plain.section?.position || 0,
            taskCount: 0,
            tasks: [],
          });
        }
        
        const section = sectionMap.get(sectionKey);
        const formattedTask = formatMyTasksBoardViewTask(task, formatters);
        if (formattedTask) {
          section.tasks.push(formattedTask);
          section.taskCount++;
        }
      });

      // Convert map to array and sort by order
      const columns = Array.from(sectionMap.values())
        .sort((a, b) => a.order - b.order);

      return res.json(successResponse({
        project: {
          id: 'my-tasks',
          name: 'My Tasks',
          color: null,
        },
        columns,
      }));
    } catch (error) {
      console.error('Error fetching my tasks board view data:', error);
      return res.status(500).json(errorResponse('Failed to fetch my tasks board view data', 500));
    }
  };

  return {
    getTasksByProject,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    batchUpdateTasks,
    reorderTasksInSection,
    moveTaskToSection,
    moveTask,
    getMyTasks,
    getMyTasksCalendarViewData,
    getMyTasksBoardViewData,
  };
};
module.exports = taskController;
