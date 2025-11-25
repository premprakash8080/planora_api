const User = require('./User');
const Team = require('./Team');
const Project = require('./Project');
const Section = require('./Section');
const Task = require('./Task');
const TeamMember = require('./TeamMember');
const ProjectMember = require('./ProjectMember');
const Subtask = require('./Subtask');
const TaskComment = require('./TaskComment');
const TaskActivityLog = require('./TaskActivityLog');
const Mail = require('./Mail');
const Attachment = require('./Attachment');
const Label = require('./Label');
const ProjectFavorite = require('./ProjectFavorite');
const TaskStatus = require('./TaskStatus');
const PriorityLabel = require('./PriorityLabel');
const Workspace = require('./Workspace');
const TaskFollower = require('./TaskFollower');
const Dependency = require('./Dependency');
const CustomField = require('./CustomField');
const CustomFieldValue = require('./CustomFieldValue');
const TaskReaction = require('./TaskReaction');
const InboxNotification = require('./InboxNotification');
const ProjectMessage = require('./ProjectMessage');
const Channel = require('./Channel');
const ChannelMember = require('./ChannelMember');
const ChannelMessageRead = require('./ChannelMessageRead');

// Define associations
// User associations
User.hasMany(Team, { foreignKey: 'created_by', as: 'createdTeams' });
User.hasMany(Project, { foreignKey: 'created_by', as: 'createdProjects' });
User.hasMany(Task, { foreignKey: 'created_by', as: 'createdTasks' });
User.hasMany(Task, { foreignKey: 'assigned_to', as: 'assignedTasks' });
User.hasMany(Workspace, { foreignKey: 'created_by', as: 'createdWorkspaces' });
User.hasMany(TaskFollower, { foreignKey: 'user_id', as: 'followedTasks' });
User.hasMany(TaskReaction, { foreignKey: 'user_id', as: 'taskReactions' });
User.hasMany(InboxNotification, { foreignKey: 'user_id', as: 'notifications' });
User.hasMany(CustomField, { foreignKey: 'created_by', as: 'createdCustomFields' });
User.hasMany(ProjectMessage, { foreignKey: 'author_id', as: 'projectMessages' });

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
Project.hasMany(TaskStatus, { foreignKey: 'project_id', as: 'taskStatuses' });
Project.hasMany(PriorityLabel, { foreignKey: 'project_id', as: 'priorityLabels' });
Project.hasMany(CustomField, { foreignKey: 'project_id', as: 'customFields' });
Project.hasMany(InboxNotification, { foreignKey: 'project_id', as: 'notifications' });
Project.hasMany(ProjectMessage, { foreignKey: 'project_id', as: 'messages' });

// Section associations
Section.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
Section.hasMany(Task, { foreignKey: 'section_id', as: 'tasks' });

// Task associations
Task.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
Task.belongsTo(Section, { foreignKey: 'section_id', as: 'section' });
Task.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Task.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });
// Note: parent_id associations commented out - column doesn't exist in database yet
// Task.belongsTo(Task, { foreignKey: 'parent_id', as: 'parent' }); // For subtasks
// Task.hasMany(Task, { foreignKey: 'parent_id', as: 'childTasks' }); // Subtasks stored as tasks
Task.hasMany(Subtask, { foreignKey: 'task_id', as: 'subtasks' });
Task.hasMany(TaskComment, { foreignKey: 'task_id', as: 'comments' });
Task.hasMany(Attachment, { foreignKey: 'task_id', as: 'attachments' });
Task.belongsTo(TaskStatus, { foreignKey: 'task_status_id', as: 'taskStatus' });
Task.belongsTo(PriorityLabel, { foreignKey: 'priority_label_id', as: 'priorityLabel' });
Task.hasMany(TaskFollower, { foreignKey: 'task_id', as: 'followers' });
Task.hasMany(Dependency, { foreignKey: 'task_id', as: 'dependencies' });
Task.hasMany(Dependency, { foreignKey: 'depends_on_task_id', as: 'dependents' });
Task.hasMany(CustomFieldValue, { foreignKey: 'task_id', as: 'customFieldValues' });
Task.hasMany(TaskReaction, { foreignKey: 'task_id', as: 'reactions' });
Task.hasMany(InboxNotification, { foreignKey: 'task_id', as: 'notifications' });

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

// TaskActivityLog associations
TaskActivityLog.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
TaskActivityLog.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
TaskActivityLog.belongsTo(User, { foreignKey: 'updated_by', as: 'user' });
Task.hasMany(TaskActivityLog, { foreignKey: 'task_id', as: 'activityLogs' });
Project.hasMany(TaskActivityLog, { foreignKey: 'project_id', as: 'activityLogs' });

// Mail associations
Mail.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
Mail.belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });
User.hasMany(Mail, { foreignKey: 'sender_id', as: 'sentMails' });
User.hasMany(Mail, { foreignKey: 'recipient_id', as: 'receivedMails' });

// Attachment associations
Attachment.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
Attachment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Label associations
Label.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

// ProjectFavorite associations
ProjectFavorite.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
ProjectFavorite.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// TaskStatus associations
TaskStatus.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
TaskStatus.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
TaskStatus.hasMany(Task, { foreignKey: 'task_status_id', as: 'tasks' });
User.hasMany(TaskStatus, { foreignKey: 'created_by', as: 'createdTaskStatuses' });

// PriorityLabel associations
PriorityLabel.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
PriorityLabel.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
PriorityLabel.hasMany(Task, { foreignKey: 'priority_label_id', as: 'tasks' });
User.hasMany(PriorityLabel, { foreignKey: 'created_by', as: 'createdPriorityLabels' });

// Workspace associations
Workspace.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// TaskFollower associations
TaskFollower.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
TaskFollower.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Dependency associations
Dependency.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
Dependency.belongsTo(Task, { foreignKey: 'depends_on_task_id', as: 'dependsOnTask' });

// CustomField associations
CustomField.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
CustomField.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
CustomField.hasMany(CustomFieldValue, { foreignKey: 'custom_field_id', as: 'values' });

// CustomFieldValue associations
CustomFieldValue.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
CustomFieldValue.belongsTo(CustomField, { foreignKey: 'custom_field_id', as: 'customField' });

// TaskReaction associations
TaskReaction.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
TaskReaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// InboxNotification associations
InboxNotification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
InboxNotification.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
InboxNotification.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

// ProjectMessage associations
ProjectMessage.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
ProjectMessage.belongsTo(User, { foreignKey: 'author_id', as: 'author' });

// Channel associations
Channel.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Channel.hasMany(ChannelMember, { foreignKey: 'channel_id', as: 'members' });
Channel.hasMany(ChannelMessageRead, { foreignKey: 'channel_id', as: 'messageReads' });
User.hasMany(Channel, { foreignKey: 'created_by', as: 'createdChannels' });

// ChannelMember associations
ChannelMember.belongsTo(Channel, { foreignKey: 'channel_id', as: 'channel' });
ChannelMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(ChannelMember, { foreignKey: 'user_id', as: 'channelMemberships' });

// ChannelMessageRead associations
ChannelMessageRead.belongsTo(Channel, { foreignKey: 'channel_id', as: 'channel' });
ChannelMessageRead.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

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
  TaskActivityLog,
  Mail,
  Attachment,
  Label,
  ProjectFavorite,
  TaskStatus,
  PriorityLabel,
  Workspace,
  TaskFollower,
  Dependency,
  CustomField,
  CustomFieldValue,
  TaskReaction,
  InboxNotification,
  ProjectMessage,
  Channel,
  ChannelMember,
  ChannelMessageRead,
};

