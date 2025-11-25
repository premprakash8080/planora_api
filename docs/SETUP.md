# Setup Guide

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

   **Note:** This will install `express-validator` which is required for input validation.

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=2017
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=planora_db
DB_DIALECT=mysql

# JWT Configuration (for authentication - TODO)
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# AWS Configuration (for file uploads - optional)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_bucket_name

# Email Configuration (for notifications - optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_password
```

## Quick Start

1. Install dependencies: `npm install`
2. Create MySQL database: `CREATE DATABASE planora_db;`
3. Import schema: `mysql -u root -p planora_db < src/sql/database.sql`
4. Configure `.env` file with your database credentials
5. Start server: `npm run dev`

