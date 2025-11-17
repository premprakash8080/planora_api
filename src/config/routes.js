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
  
  // API Routes
  app.use("/api/users", users);
  app.use("/api/projects", projects);
  app.use("/api/tasks", tasks);
  app.use("/api/sections", sections);
  app.use("/api/comments", taskComments);
  app.use("/api/teams", teams);
};
