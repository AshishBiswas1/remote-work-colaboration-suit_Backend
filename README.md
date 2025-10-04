# Remote Work Collaboration Suite - Backend

A comprehensive backend API for a remote work collaboration platform with real-time features, built with Node.js, Express, and Supabase.

## 🚀 Features

- **Real-time Communication**: Socket.IO for instant messaging and collaboration
- **Database Integration**: Supabase for robust data management
- **Authentication Ready**: JWT and Supabase Auth integration
- **File Upload Support**: Multer for document sharing
- **Security**: Helmet, CORS, and rate limiting
- **Video Call Support**: WebRTC signaling through Socket.IO
- **Email Notifications**: Nodemailer integration
- **Development Tools**: Hot reload with nodemon

## 📦 Dependencies Installed

### Core Dependencies
- `express` - Web framework
- `@supabase/supabase-js` - Supabase client
- `socket.io` - Real-time communication
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variables
- `helmet` - Security middleware
- `morgan` - HTTP request logger
- `express-rate-limit` - Rate limiting

### Authentication & Security
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT tokens

### File Handling & Communication
- `multer` - File uploads
- `nodemailer` - Email notifications
- `uuid` - Unique identifier generation

### Development
- `nodemon` - Auto-restart during development

## 🛠️ Setup

1. **Environment Variables**: Configure `Config.env` with your Supabase credentials
2. **Install Dependencies**: Already done with `npm install`
3. **Start Development Server**: `npm run start:dev`
4. **Start Production Server**: `npm start`

## 🔧 Configuration

The `Config.env` file contains:
- Supabase connection details
- Server configuration (PORT, NODE_ENV)
- JWT secrets
- Email settings
- File upload limits

## 🔌 Socket.IO Events

- `join-workspace` - Join a collaboration workspace
- `leave-workspace` - Leave a workspace
- `document-edit` - Real-time document editing
- `chat-message` - Instant messaging
- `video-call-offer/answer` - Video call signaling
- `ice-candidate` - WebRTC connection handling

## 📁 Project Structure

```
├── server.js              # Main server file
├── util/
│   └── supabaseClient.js  # Supabase connection setup
├── Config.env             # Environment variables
├── package.json           # Dependencies and scripts
└── README.md             # This file
```

## 🚀 API Endpoints

- `GET /health` - Health check
- `GET /api` - API information

## 🔗 Supabase Integration

The `util/supabaseClient.js` provides:
- Standard Supabase client for frontend operations
- Admin client for server-side operations
- Connection testing and validation

## 🎯 Next Steps

1. Create API routes for:
   - User authentication
   - Workspace management
   - Document collaboration
   - File sharing
   - Video call management

2. Set up Supabase database schema
3. Implement authentication middleware
4. Add comprehensive error handling
5. Set up logging and monitoring

## 🚀 Getting Started

```bash
# Start development server
npm run start:dev

# Start production server
npm start
```

The server will run on `http://localhost:5000` by default.
