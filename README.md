# Planora Task Management API

A Node.js/Express backend API for the Planora task management system.

## Features

- ✅ RESTful API for task management
- ✅ Sequelize ORM with MySQL
- ✅ Project, Task, and Section management
- ✅ User authentication ready (JWT)
- ✅ Soft deletes for data preservation
- ✅ Database triggers for automatic comment counting

## Prerequisites

- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database credentials and configuration.

4. Create the database:
   ```sql
   CREATE DATABASE planora_db;
   ```

5. Run the database migrations:
   ```bash
   # Import the SQL schema
   mysql -u root -p planora_db < src/sql/database.sql
   ```

## Running the Application

### Development Mode
```bash
npm run dev
# or
npm start
```

### Testing Mode
```bash
npm run testing
```

The server will start on port 2017 (or the port specified in your `.env` file).

## API Endpoints

### Authentication & Users
- `POST /api/users/register` - Register new user (public)
- `POST /api/users/login` - Login user (public)
- `GET /api/users/profile` - Get current user profile (protected)
- `PUT /api/users/profile` - Update user profile (protected)

### Projects
- `GET /api/projects` - Get all projects
- `GET /api/projects/:projectId` - Get project by ID
- `POST /api/projects` - Create new project
- `PUT /api/projects/:projectId` - Update project
- `DELETE /api/projects/:projectId` - Delete project (soft delete)
- `PATCH /api/projects/:projectId/toggle-favorite` - Toggle project favorite

### Tasks
- `GET /api/tasks/project/:projectId` - Get all tasks for a project
- `GET /api/tasks/:taskId` - Get task by ID
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:taskId` - Update task
- `DELETE /api/tasks/:taskId` - Delete task (soft delete)
- `PATCH /api/tasks/:taskId/toggle-completion` - Toggle task completion

### Sections
- `GET /api/sections/project/:projectId` - Get all sections for a project
- `POST /api/sections` - Create new section
- `PUT /api/sections/:sectionId` - Update section
- `PATCH /api/sections/:sectionId/title` - Update section title
- `DELETE /api/sections/:sectionId` - Delete section

### Teams
- `GET /api/teams` - Get all teams for current user
- `GET /api/teams/:teamId` - Get team by ID
- `POST /api/teams` - Create new team
- `PUT /api/teams/:teamId` - Update team
- `DELETE /api/teams/:teamId` - Delete team
- `POST /api/teams/:teamId/members` - Add member to team
- `DELETE /api/teams/:teamId/members/:memberId` - Remove member from team

### Task Comments
- `GET /api/comments/task/:taskId` - Get all comments for a task
- `GET /api/comments/:commentId` - Get comment by ID
- `POST /api/comments` - Create new comment
- `PUT /api/comments/:commentId` - Update comment
- `DELETE /api/comments/:commentId` - Delete comment

## Database Schema

The database schema includes:
- Users
- Teams & Team Members
- Projects & Project Members
- Sections
- Tasks
- Subtasks
- Task Comments
- Attachments
- Labels & Task Labels
- Project Favorites
- Activity Logs

See `src/sql/database.sql` for the complete schema.

## Project Structure

```
planora_api/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Custom middleware (auth, validation, error handling)
│   ├── models/          # Sequelize models
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   ├── sql/             # SQL schema files
│   └── utils/           # Utility functions
├── server.js            # Main application entry point
└── package.json
```

## Features Implemented

- ✅ JWT Authentication middleware
- ✅ User registration and login
- ✅ Team management (CRUD + member management)
- ✅ Task comment endpoints
- ✅ Input validation using express-validator
- ✅ Error handling middleware
- ✅ Protected routes with authentication
- ✅ Soft deletes for data preservation

## TODO

- [ ] Add subtask endpoints
- [ ] Add file upload endpoints
- [ ] Add activity log tracking
- [ ] Add API documentation (Swagger)
- [ ] Add rate limiting
- [ ] Add request logging

## Development Notes

- The database uses soft deletes (paranoid mode) for most entities
- Comment counts are automatically maintained via database triggers
- Project favorites are user-specific (stored in `project_favorites` table)
- Task status values: 'To Do', 'In Progress', 'Done', 'On Track', 'At Risk', 'Off Track'
- Task priority values: 'Low', 'Medium', 'High'
- Project status values: 'not-started', 'in-progress', 'on-hold', 'completed'

## License

ISC

