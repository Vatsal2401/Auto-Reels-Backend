# Authentication Module

Complete authentication system with email/password, Google OAuth, and Microsoft OAuth.

## Features

- ✅ Email/Password signup and signin
- ✅ Google OAuth
- ✅ Microsoft OAuth
- ✅ JWT access tokens (15min expiry)
- ✅ Refresh tokens (7 days expiry)
- ✅ Protected routes with JWT guard
- ✅ User profile management

## API Endpoints

### Email/Password Auth

**Sign Up:**

```bash
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Sign In:**

```bash
POST /auth/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Refresh Token:**

```bash
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "your-refresh-token"
}
```

**Get Current User:**

```bash
GET /auth/me
Authorization: Bearer <access_token>
```

### OAuth

**Google:**

- Initiate: `GET /auth/google`
- Callback: `GET /auth/google/callback` (handled automatically)

**Microsoft:**

- Initiate: `GET /auth/microsoft`
- Callback: `GET /auth/microsoft/callback` (handled automatically)

## Setup OAuth

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
4. Add to `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

### Microsoft OAuth

1. Go to [Azure Portal](https://portal.azure.com/)
2. Register an application
3. Add redirect URI: `http://localhost:3000/auth/microsoft/callback`
4. Add to `.env`:
   ```
   MICROSOFT_CLIENT_ID=your-client-id
   MICROSOFT_CLIENT_SECRET=your-client-secret
   ```

## Protected Routes

Use `@UseGuards(JwtAuthGuard)` and `@CurrentUser()` decorator:

```typescript
@Get('protected')
@UseGuards(JwtAuthGuard)
async protectedRoute(@CurrentUser() user: any) {
  // user.userId and user.email available
}
```

## Environment Variables

```env
JWT_SECRET=your-secret-key
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
FRONTEND_URL=http://localhost:3001
```
