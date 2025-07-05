# Family Chores App

A comprehensive family chore management application that helps families organize tasks, track completion, and manage rewards.

## Features

- **Family Management**: Create and manage family accounts with unique family codes
- **User Roles**: Support for parents and children with different permissions
- **Chore System**: Create, assign, and track chores with customizable rewards
- **Photo Verification**: Optional photo submission for chore completion
- **Reward Tracking**: Monitor earnings and completed tasks
- **Progressive Web App**: Install on mobile devices for easy access
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Quick Start

### Prerequisites

- Docker Desktop installed and running
- Node.js 18+ (for development)
- Git

### Using Docker (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/zanijr/WebApp.git
   cd WebApp
   ```

2. **Start Docker Desktop** (if not already running)

3. **Build and run the application**:
   ```bash
   docker-compose up --build
   ```

4. **Access the application**:
   - Open your browser and go to `http://localhost` or `http://192.168.12.220`
   - The application will be available on port 80

### Manual Setup (Development)

If you prefer to run without Docker:

1. **Set up the database**:
   - Install MySQL 8.0
   - Create a database named `family_chores`
   - Run the SQL script from `database/init.sql`

2. **Configure environment variables**:
   ```bash
   cd api
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Install and run the API**:
   ```bash
   cd api
   npm install
   npm start
   ```

4. **Serve the frontend**:
   ```bash
   cd frontend
   # Use any static file server, e.g.:
   python -m http.server 8080
   # or
   npx serve .
   ```

## Usage

### Getting Started

1. **Register a Family**:
   - Click "Don't have a family code? Register here"
   - Enter your family name and admin email
   - You'll receive a unique family code

2. **Add Family Members**:
   - Log in as a parent
   - Go to the Family tab
   - Click "Add Member" to add children and other parents

3. **Create Chores**:
   - Parents can create chores in the Manage tab
   - Set rewards (money or screen time)
   - Configure photo requirements and timers

4. **Assign and Complete Chores**:
   - Parents assign chores to children
   - Children accept/decline and submit completion
   - Parents review and approve submissions

### Family Roles

- **Parents**: Can create chores, assign tasks, review submissions, and manage family members
- **Children**: Can accept/decline chores, submit completion, and track their earnings

## Architecture

### Backend (Node.js/Express)
- RESTful API with JWT authentication
- MySQL database with comprehensive schema
- File upload handling for photos
- Role-based access control

### Frontend (Vanilla JS/Alpine.js)
- Progressive Web App (PWA)
- Responsive design with Tailwind CSS
- Offline capability with service workers
- Real-time updates

### Infrastructure
- Docker containerization
- Nginx reverse proxy
- MySQL database
- Volume persistence for uploads and data

## API Endpoints

### Authentication
- `POST /api/auth/family/login` - Login with family code
- `POST /api/auth/user/login` - Select user profile
- `GET /api/auth/verify` - Verify JWT token

### Families
- `POST /api/families/register` - Register new family
- `POST /api/families/:id/members` - Add family member

### Chores
- `GET /api/chores` - Get all family chores
- `POST /api/chores` - Create new chore (parents only)
- `POST /api/chores/:id/assign` - Assign chore (parents only)
- `POST /api/chores/:id/accept` - Accept chore (children only)
- `POST /api/chores/:id/decline` - Decline chore (children only)
- `POST /api/chores/:id/submit` - Submit completion (children only)

### Users
- `GET /api/users/profile` - Get user profile and stats
- `GET /api/users/chores` - Get user's assigned chores
- `GET /api/users/family/members` - Get family members

## Database Schema

The application uses a comprehensive MySQL schema with the following main tables:

- `families` - Family information and settings
- `users` - Family members with roles and earnings
- `chores` - Chore definitions and current state
- `chore_assignments` - Assignment tracking
- `chore_submissions` - Completion submissions
- `completed_tasks` - Approved completions

## Configuration

### Environment Variables

Create a `.env` file in the `api` directory:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=family_chores

# JWT
JWT_SECRET=your-super-secret-jwt-key-here

# Server
PORT=3000
NODE_ENV=production

# File Upload
UPLOAD_MAX_SIZE=5242880
```

### Docker Configuration

The application uses Docker Compose with the following services:

- **nginx**: Reverse proxy and static file server
- **api**: Node.js backend application
- **db**: MySQL 8.0 database

## Security Features

- JWT-based authentication
- Role-based access control
- Input validation and sanitization
- File upload restrictions
- Rate limiting on API endpoints
- CORS configuration
- Security headers

## Mobile App Features

The application is a Progressive Web App (PWA) that can be installed on mobile devices:

- Offline functionality
- Push notifications (future feature)
- Native app-like experience
- Responsive design for all screen sizes

## Development

### Project Structure

```
WebApp/
├── api/                 # Backend Node.js application
│   ├── config/         # Database and app configuration
│   ├── middleware/     # Authentication and validation
│   ├── routes/         # API route handlers
│   ├── uploads/        # File upload storage
│   └── server.js       # Main application entry
├── database/           # Database schema and migrations
├── frontend/           # Frontend application
│   ├── index.html      # Main application page
│   ├── app.js          # JavaScript application logic
│   ├── manifest.json   # PWA manifest
│   └── sw.js           # Service worker
├── nginx/              # Nginx configuration
└── docker-compose.yml  # Docker orchestration
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Troubleshooting

### Common Issues

1. **Docker not starting**: Ensure Docker Desktop is installed and running
2. **Database connection errors**: Check MySQL credentials in `.env`
3. **Port conflicts**: Ensure ports 80, 3000, and 3306 are available
4. **File upload issues**: Check upload directory permissions

### Logs

- Application logs: `docker-compose logs api`
- Database logs: `docker-compose logs db`
- Nginx logs: `docker-compose logs nginx`

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please open an issue on GitHub or contact the development team.
