const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { User, Project, Section, Task, Team, TeamMember } = require('../models');
const tableNames = require('../config/table_names');

/**
 * Initialize pre-populated data if tables are empty
 * Reads configuration from preData.json and creates default data
 */
const initiatePreData = async () => {
  try {
    console.log('Initializing pre-data...');

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

    // Check if users exist using table name
    const userCount = await User.count();
    
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
            team_id: global.sampleTeam ? global.sampleTeam.id : null,
          });

          console.log(`✅ Project created: ${project.name}`);
          
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

      // Create tasks
      if (preData.tasks && preData.tasks.length > 0 && global.sampleProject && global.sections) {
        const tasks = await Task.bulkCreate(
          preData.tasks.map(taskData => ({
            project_id: global.sampleProject.id,
            section_id: global.sections[taskData.section_index]?.id || null,
            title: taskData.title,
            description: taskData.description || null,
            created_by: global.adminUser.id,
            assigned_to: global.adminUser.id,
            priority: taskData.priority || 'Medium',
            status: taskData.status || 'To Do',
            completed: taskData.completed || false,
            position: taskData.position || 0,
          }))
        );

        console.log(`✅ ${tasks.length} tasks created`);
      }

      // Clean up global variables
      delete global.adminUser;
      delete global.sampleTeam;
      delete global.sampleProject;
      delete global.sections;

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
