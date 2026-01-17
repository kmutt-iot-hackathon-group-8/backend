# Required Render Environment Variables

## Critical for OAuth to work:

1. **BETTER_AUTH_URL**

   - Value: `https://backend-h6j3.onrender.com`
   - This MUST match your actual backend URL

2. **FRONTEND_URL**

   - Value: Your actual frontend URL (e.g., `https://frontend-git-feat-api-mykal-steeles-projects.vercel.app`)
   - No trailing slash

3. **NODE_ENV**

   - Value: `production`

4. **GOOGLE_CLIENT_ID**

   - Your Google OAuth client ID

5. **GOOGLE_CLIENT_SECRET**

   - Your Google OAuth client secret

6. **DATABASE_URL**
   - Your PostgreSQL connection string

## Google Cloud Console Settings

Make sure these redirect URIs are added:

- `https://backend-h6j3.onrender.com/api/auth/callback/google`
- Any other frontend URLs where users might initiate login

## Vercel Environment Variables (Frontend)

1. **VITE_API_URL**
   - Value: `https://backend-h6j3.onrender.com`
