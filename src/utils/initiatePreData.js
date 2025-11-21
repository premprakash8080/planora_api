const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { 
  User, Project, Section, Task, Team, TeamMember, Mail, 
  ProjectMember, Subtask, TaskComment, Label, 
  ProjectFavorite, TaskActivityLog, TaskStatus, PriorityLabel
} = require('../models');
const database = require('../config/database');
const tableNames = require('../config/table_names');

/**
 * Check if a table exists in the database
 */
const tableExists = async (tableName) => {
  try {
    const [results] = await database.query(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = DATABASE() AND table_name = ?`,
      { replacements: [tableName] }
    );
    return results && results.length > 0 && results[0].count > 0;
  } catch (error) {
    return false;
  }
};

/**
 * Wait for tables to be created (with retry logic)
 */
const waitForTables = async (maxRetries = 10, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    const exists = await tableExists('users');
    if (exists) {
      return true;
    }
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return false;
};

/**
 * Initialize pre-populated data if tables are empty
 * Reads configuration from preData.json and creates default data
 */
const initiatePreData = async () => {
  try {
    console.log('Initializing pre-data...');

    // Wait for tables to be created
    const tablesReady = await waitForTables(10, 1000);
    if (!tablesReady) {
      console.log('⚠️  Database tables not found after waiting. Please ensure database is properly set up.');
      return;
    }

    // Load pre-data configuration
    const preDataPath = path.join(__dirname, '../config/preData.json');
    let preData;
    
    try {
      const preDataFile = fs.readFileSync(preDataPath, 'utf8');
      preData = JSON.parse(preDataFile);
    } catch (error) {
      console.warn('⚠️  preData.json not found or invalid. Skipping pre-data initialization.');
      return;
    }

    // Check if users exist - wrap in try-catch for safety
    let userCount = 0;
    try {
      userCount = await User.count();
    } catch (error) {
      console.warn('⚠️  Error checking user count. Tables may not be ready yet.');
      return;
    }
    
    if (userCount === 0) {
      console.log('No users found. Creating pre-data from configuration...');
      
      // Create users
      if (preData.users && preData.users.length > 0) {
        for (const userData of preData.users) {
          // Hash password
          const password_hash = await bcrypt.hash(userData.password, 10);
          
          // Generate initials if not provided
          const initials = userData.initials || userData.full_name
            .split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
          
          // Generate avatar color if not provided
          const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f97316', '#ef4444'];
          const avatar_color = userData.avatar_color || colors[userData.full_name.length % colors.length];
          
          const user = await User.create({
            full_name: userData.full_name,
            email: userData.email,
            password_hash,
            initials,
            avatar_color,
            status: userData.status || 'active',
          });

          console.log(`✅ User created: ${user.email} (Password: ${userData.password})`);
          
          // Store users array
          if (!global.users) {
            global.users = [];
          }
          global.users.push(user);
          
          // Store first user as admin for creating related data
          if (!global.adminUser) {
            global.adminUser = user;
          }
        }
      }

      // Create teams
      if (preData.teams && preData.teams.length > 0 && global.adminUser) {
        for (const teamData of preData.teams) {
          const team = await Team.create({
            name: teamData.name,
            description: teamData.description || null,
            created_by: global.adminUser.id,
          });

          // Add admin as team owner
          await TeamMember.create({
            team_id: team.id,
            user_id: global.adminUser.id,
            role: 'owner',
          });

          console.log(`✅ Team created: ${team.name}`);
          
          // Store first team for project creation
          if (!global.sampleTeam) {
            global.sampleTeam = team;
          }
        }
      }

      // Create projects
      if (preData.projects && preData.projects.length > 0 && global.adminUser) {
        for (const projectData of preData.projects) {
          const project = await Project.create({
            name: projectData.name,
            description: projectData.description || null,
            color: projectData.color || null,
            created_by: global.adminUser.id,
            status: projectData.status || 'not-started',
            health_status: projectData.health_status || 'on-track',
            team_id: global.sampleTeam ? global.sampleTeam.id : null,
          });

          console.log(`✅ Project created: ${project.name}`);
          
          // Store projects array
          if (!global.projects) {
            global.projects = [];
          }
          global.projects.push(project);
          
          // Store first project for sections and tasks
          if (!global.sampleProject) {
            global.sampleProject = project;
          }
        }
      }

      // Create sections
      if (preData.sections && preData.sections.length > 0 && global.sampleProject) {
        const sections = await Section.bulkCreate(
          preData.sections.map(sectionData => ({
            project_id: global.sampleProject.id,
            name: sectionData.name,
            position: sectionData.position || 0,
          }))
        );

        console.log(`✅ ${sections.length} sections created`);
        global.sections = sections;
      }

      // Create task statuses (before tasks, so tasks can reference them)
      if (preData.task_statuses && preData.task_statuses.length > 0 && global.projects && global.users) {
        const taskStatuses = await TaskStatus.bulkCreate(
          preData.task_statuses.map(statusData => ({
            project_id: statusData.project_index !== null && statusData.project_index !== undefined 
              ? global.projects[statusData.project_index]?.id 
              : null,
            name: statusData.name,
            color: statusData.color || null,
            icon: statusData.icon || null,
            description: statusData.description || null,
            order: statusData.order || 0,
            is_default: statusData.is_default || false,
            is_active: true,
            created_by: global.users[statusData.created_by_index]?.id || global.adminUser.id,
          }))
        );

        console.log(`✅ ${taskStatuses.length} task statuses created`);
        global.taskStatuses = taskStatuses;
      }

      // Create priority labels (before tasks, so tasks can reference them)
      if (preData.priority_labels && preData.priority_labels.length > 0 && global.projects && global.users) {
        const priorityLabels = await PriorityLabel.bulkCreate(
          preData.priority_labels.map(labelData => ({
            project_id: labelData.project_index !== null && labelData.project_index !== undefined 
              ? global.projects[labelData.project_index]?.id 
              : null,
            name: labelData.name,
            color: labelData.color || null,
            icon: labelData.icon || null,
            description: labelData.description || null,
            order: labelData.order || 0,
            is_default: labelData.is_default || false,
            is_active: true,
            created_by: global.users[labelData.created_by_index]?.id || global.adminUser.id,
          }))
        );

        console.log(`✅ ${priorityLabels.length} priority labels created`);
        global.priorityLabels = priorityLabels;
      }

      // Create tasks
      if (preData.tasks && preData.tasks.length > 0 && global.sampleProject && global.sections && global.users) {
        // Group tasks by section to calculate positions properly
        const tasksBySection = {};
        preData.tasks.forEach((taskData, index) => {
          const sectionIndex = taskData.section_index || 0;
          if (!tasksBySection[sectionIndex]) {
            tasksBySection[sectionIndex] = [];
          }
          tasksBySection[sectionIndex].push({ ...taskData, originalIndex: index });
        });

        // Create tasks with proper decimal positions
        // Process tasks section by section to maintain proper ordering
        const allTasks = [];
        for (const [sectionIndex, sectionTasks] of Object.entries(tasksBySection)) {
          const sectionId = global.sections[parseInt(sectionIndex)]?.id || null;
          
          // Sort tasks by their position value from preData.json to maintain order
          sectionTasks.sort((a, b) => {
            const posA = a.position !== undefined && a.position !== null ? parseFloat(a.position) : 0;
            const posB = b.position !== undefined && b.position !== null ? parseFloat(b.position) : 0;
            return posA - posB;
          });

          // Assign positions: 1.0, 2.0, 3.0, etc. for each section
          sectionTasks.forEach((taskData, taskIndex) => {
            // Use position from preData.json if provided, otherwise calculate sequential position
            const position = taskData.position !== undefined && taskData.position !== null
              ? parseFloat(taskData.position)
              : (taskIndex + 1) * 1.0;
            
            allTasks.push({
              project_id: global.sampleProject.id,
              section_id: sectionId,
              title: taskData.title,
              description: taskData.description || null,
              created_by: global.adminUser.id,
              assigned_to: global.users[taskData.assigned_to_index]?.id || global.adminUser.id,
              priority_label_id: taskData.priority_label_index !== undefined && taskData.priority_label_index !== null
                ? global.priorityLabels[taskData.priority_label_index]?.id || null
                : null,
              task_status_id: taskData.task_status_index !== undefined && taskData.task_status_index !== null
                ? global.taskStatuses[taskData.task_status_index]?.id || null
                : null,
              completed: taskData.completed || false,
              position: position, // Use decimal position (1.0, 2.0, 3.0, etc.) matching DECIMAL(20, 10) type
              start_date: taskData.start_date || taskData.due_date || null,
              due_date: taskData.due_date || null,
            });
          });
        }

        const tasks = await Task.bulkCreate(allTasks);

        console.log(`✅ ${tasks.length} tasks created`);
        global.tasks = tasks;
      }

      // Create project members
      if (preData.project_members && preData.project_members.length > 0 && global.projects && global.users) {
        const projectMembers = await ProjectMember.bulkCreate(
          preData.project_members.map(memberData => ({
            project_id: global.projects[memberData.project_index]?.id,
            user_id: global.users[memberData.user_index]?.id,
            role: memberData.role || 'member',
          }))
        );

        console.log(`✅ ${projectMembers.length} project members created`);
      }

      // Create subtasks
      if (preData.subtasks && preData.subtasks.length > 0 && global.tasks) {
        const subtasks = await Subtask.bulkCreate(
          preData.subtasks.map(subtaskData => ({
            task_id: global.tasks[subtaskData.task_index]?.id,
            title: subtaskData.title,
            is_completed: subtaskData.is_completed || false,
          }))
        );

        console.log(`✅ ${subtasks.length} subtasks created`);
      }

      // Create task comments
      if (preData.task_comments && preData.task_comments.length > 0 && global.tasks && global.users) {
        const comments = await TaskComment.bulkCreate(
          preData.task_comments.map(commentData => ({
            task_id: global.tasks[commentData.task_index]?.id,
            user_id: global.users[commentData.user_index]?.id,
            message: commentData.message,
          }))
        );

        console.log(`✅ ${comments.length} task comments created`);
      }

      // Create labels
      if (preData.labels && preData.labels.length > 0 && global.projects) {
        const labels = await Label.bulkCreate(
          preData.labels.map(labelData => ({
            project_id: global.projects[labelData.project_index]?.id,
            name: labelData.name,
            color: labelData.color || null,
          }))
        );

        console.log(`✅ ${labels.length} labels created`);
        global.labels = labels;
      }

      // Create project favorites
      if (preData.project_favorites && preData.project_favorites.length > 0 && global.projects && global.users) {
        const favorites = await ProjectFavorite.bulkCreate(
          preData.project_favorites.map(favData => ({
            project_id: global.projects[favData.project_index]?.id,
            user_id: global.users[favData.user_index]?.id,
          }))
        );

        console.log(`✅ ${favorites.length} project favorites created`);
      }

      // Create mails
      if (preData.mails && preData.mails.length > 0 && global.adminUser && global.users) {
        const mails = await Mail.bulkCreate(
          preData.mails.map(mailData => ({
            sender_id: global.adminUser.id,
            recipient_id: global.users[mailData.recipient_index]?.id || global.adminUser.id,
            subject: mailData.subject,
            body: mailData.body,
            is_read: mailData.is_read || false,
            is_starred: mailData.is_starred || false,
            is_archived: mailData.is_archived || false,
          }))
        );

        console.log(`✅ ${mails.length} mails created`);
      }

      // Create activity logs
      if (preData.activity_logs && preData.activity_logs.length > 0 && global.tasks && global.projects && global.users) {
        const activityLogs = await TaskActivityLog.bulkCreate(
          preData.activity_logs.map(logData => ({
            task_id: global.tasks[logData.task_index]?.id,
            project_id: global.projects[logData.project_index]?.id,
            activity_type: logData.activity_type,
            description: logData.description,
            old_value: logData.old_value || null,
            new_value: logData.new_value || null,
            updated_by: global.users[logData.updated_by_index]?.id || global.adminUser.id,
          }))
        );

        console.log(`✅ ${activityLogs.length} activity logs created`);
      }


      // Clean up global variables
      delete global.adminUser;
      delete global.users;
      delete global.sampleTeam;
      delete global.sampleProject;
      delete global.projects;
      delete global.sections;
      delete global.tasks;
      delete global.labels;
      delete global.taskStatuses;
      delete global.priorityLabels;

      console.log('\n📋 Pre-data initialization complete!');
      
      // Display credentials
      if (preData.users && preData.users.length > 0) {
        console.log('\n🔑 Default Credentials:');
        preData.users.forEach(user => {
          console.log(`   Email: ${user.email}`);
          console.log(`   Password: ${user.password}`);
        });
        console.log('\n⚠️  Please change the default passwords after first login!\n');
      }
    } else {
      console.log(`✅ Users already exist (${userCount} users found). Skipping pre-data initialization.`);
    }
  } catch (error) {
    console.error('❌ Error initializing pre-data:', error.message);
    console.error(error.stack);
    // Don't throw - allow server to continue even if pre-data fails
  }
};

module.exports = initiatePreData;
