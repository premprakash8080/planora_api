/**
 * Import Route files and set in express middleware
 */

exports.set_routes = (app) => {
  // User routes (public: register/login, protected: profile)
  const users = require("../routes/users");
  // Task Management Routes (all protected)
  const projects = require("../routes/projects");
  const tasks = require("../routes/tasks");
  const sections = require("../routes/sections");
  const taskComments = require("../routes/taskComments");
  
  // Team Management Routes (all protected)
  const teams = require("../routes/teams");
  
  // Dashboard Routes (all protected)
  const dashboard = require("../routes/dashboard");
  
  // Activity Log Routes (all protected)
  const taskActivityLogs = require("../routes/taskActivityLogs");
  
  // Member Routes (all protected)
  const members = require("../routes/members");
  
  // Mail Routes (all protected)
  const mails = require("../routes/mails");
  
  // Activity Log Routes (all protected)
  const activityLogs = require("../routes/activityLogs");
  
  // Insights Routes (all protected)
  const insights = require("../routes/insights");
  
  // Task Status Routes (all protected)
  const taskStatuses = require("../routes/taskStatuses");
  
  // Priority Label Routes (all protected)
  const priorityLabels = require("../routes/priorityLabels");

  // Board View Routes (all protected)
  const boardView = require("../routes/boardView");
  
  // API Routes
  app.use("/api/users", users);
  app.use("/api/projects", projects);
  app.use("/api/tasks", tasks);
  app.use("/api/sections", sections);
  app.use("/api/comments", taskComments);
  app.use("/api/teams", teams);
  app.use("/api/dashboard", dashboard);
  app.use("/api/activity-logs", activityLogs); // Use new unified activity logs route
  app.use("/api/members", members);
  app.use("/api/mails", mails);
  app.use("/api/insights", insights);
  app.use("/api/task-statuses", taskStatuses);
  app.use("/api/priority-labels", priorityLabels);
  app.use("/api/board-view", boardView);
};
