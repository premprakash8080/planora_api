const User = require('./User');
const Team = require('./Team');
const Project = require('./Project');
const Section = require('./Section');
const Task = require('./Task');
const TeamMember = require('./TeamMember');
const ProjectMember = require('./ProjectMember');
const Subtask = require('./Subtask');
const TaskComment = require('./TaskComment');
const Attachment = require('./Attachment');
const Label = require('./Label');
const TaskLabel = require('./TaskLabel');
const ProjectFavorite = require('./ProjectFavorite');

// Define associations
// User associations
User.hasMany(Team, { foreignKey: 'created_by', as: 'createdTeams' });
User.hasMany(Project, { foreignKey: 'created_by', as: 'createdProjects' });
User.hasMany(Task, { foreignKey: 'created_by', as: 'createdTasks' });
User.hasMany(Task, { foreignKey: 'assigned_to', as: 'assignedTasks' });

// Team associations
Team.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Team.hasMany(Project, { foreignKey: 'team_id', as: 'projects' });
Team.hasMany(TeamMember, { foreignKey: 'team_id', as: 'members' });

// Project associations
Project.belongsTo(Team, { foreignKey: 'team_id', as: 'team' });
Project.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Project.hasMany(Section, { foreignKey: 'project_id', as: 'sections' });
Project.hasMany(Task, { foreignKey: 'project_id', as: 'tasks' });
Project.hasMany(ProjectMember, { foreignKey: 'project_id', as: 'members' });
Project.hasMany(ProjectFavorite, { foreignKey: 'project_id', as: 'favorites' });
Project.hasMany(Label, { foreignKey: 'project_id', as: 'labels' });

// Section associations
Section.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
Section.hasMany(Task, { foreignKey: 'section_id', as: 'tasks' });

// Task associations
Task.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
Task.belongsTo(Section, { foreignKey: 'section_id', as: 'section' });
Task.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Task.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });
Task.hasMany(Subtask, { foreignKey: 'task_id', as: 'subtasks' });
Task.hasMany(TaskComment, { foreignKey: 'task_id', as: 'comments' });
Task.hasMany(Attachment, { foreignKey: 'task_id', as: 'attachments' });
Task.hasMany(TaskLabel, { foreignKey: 'task_id', as: 'taskLabels' });

// TeamMember associations
TeamMember.belongsTo(Team, { foreignKey: 'team_id', as: 'team' });
TeamMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ProjectMember associations
ProjectMember.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
ProjectMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Subtask associations
Subtask.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });

// TaskComment associations
TaskComment.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
TaskComment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Attachment associations
Attachment.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
Attachment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Label associations
Label.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
Label.hasMany(TaskLabel, { foreignKey: 'label_id', as: 'taskLabels' });

// TaskLabel associations
TaskLabel.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
TaskLabel.belongsTo(Label, { foreignKey: 'label_id', as: 'label' });

// ProjectFavorite associations
ProjectFavorite.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
ProjectFavorite.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = {
  User,
  Team,
  Project,
  Section,
  Task,
  TeamMember,
  ProjectMember,
  Subtask,
  TaskComment,
  Attachment,
  Label,
  TaskLabel,
  ProjectFavorite,
};

