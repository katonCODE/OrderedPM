# Worktree Setup Guide

This guide explains how to use Git worktrees for feature branch testing.

## What are Worktrees?

Worktrees allow you to have multiple branches checked out simultaneously in separate directories. This is useful for testing features without switching branches.

## Important Notes

⚠️ **Critical**: Each worktree is a **separate directory** with its own files. This means:

1. **Environment files (.env) are NOT copied automatically** - You must copy them manually
2. **Dependencies must be installed in each worktree** - The setup script handles this
3. **Dev servers must run from the correct worktree** - Otherwise you'll see the wrong code

## Setup Steps

### 1. Create a Worktree for Your Feature Branch

```bash
# From your main repository directory
git worktree add ../OrderedPM-feature-google-auth feature/google-auth
```

This creates a new directory `../OrderedPM-feature-google-auth` with your feature branch checked out.

### 2. Copy Environment Files

**CRITICAL**: Copy `.env` files from your main worktree to the new worktree:

```powershell
# Windows PowerShell
# Copy client .env
Copy-Item "client\.env" "../OrderedPM-feature-google-auth\client\.env"

# Copy server .env  
Copy-Item "server\.env" "../OrderedPM-feature-google-auth\server\.env"
```

Or manually create them with your credentials:
- `client/.env` - Needs `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`
- `server/.env` - Needs `DATABASE_URL`, `SUPABASE_JWT_SECRET`, and `PORT`

### 3. Install Dependencies

The worktree setup script should run automatically, but if not:

```powershell
cd ../OrderedPM-feature-google-auth
pnpm install
cd client && pnpm install
cd ../server && pnpm install
```

### 4. Start Dev Servers from Feature Worktree

⚠️ **IMPORTANT**: Make sure you're in the **feature worktree directory**, not main!

```powershell
# Terminal 1 - Backend (from feature worktree)
cd ../OrderedPM-feature-google-auth/server
pnpm run dev

# Terminal 2 - Frontend (from feature worktree)
cd ../OrderedPM-feature-google-auth/client
pnpm start
```

### 5. Verify You're Running the Right Code

- Check the terminal - it should show the feature worktree path
- Check `git branch` - should show your feature branch
- Make a test change - should appear in browser immediately

## Common Issues

### Issue: Changes not appearing in browser

**Cause**: Dev server running from wrong worktree (probably main)

**Fix**: 
1. Stop the server (Ctrl+C)
2. Navigate to feature worktree directory
3. Start server from there

### Issue: "Supabase not configured" error

**Cause**: Missing `.env` files in feature worktree

**Fix**: Copy `.env` files from main worktree (see Step 2)

### Issue: "Module not found" errors

**Cause**: Dependencies not installed in feature worktree

**Fix**: Run `pnpm install` in feature worktree root, client, and server directories

## Workflow Example: Google Auth Feature

```powershell
# 1. Create worktree for google-auth feature
git worktree add ../OrderedPM-google-auth feature/google-auth

# 2. Copy .env files
Copy-Item "client\.env" "../OrderedPM-google-auth\client\.env"
Copy-Item "server\.env" "../OrderedPM-google-auth\server\.env"

# 3. Open feature worktree in Cursor/VS Code
cd ../OrderedPM-google-auth

# 4. Make your changes (Google auth implementation)

# 5. Start dev servers from feature worktree
# Terminal 1:
cd server && pnpm run dev

# Terminal 2:
cd client && pnpm start

# 6. Test at http://localhost:3000

# 7. When done, remove worktree:
cd ../OrderedPM  # Back to main
git worktree remove ../OrderedPM-google-auth
```

## List All Worktrees

```bash
git worktree list
```

## Remove a Worktree

```bash
# From main repository
git worktree remove ../OrderedPM-feature-name
```

## Tips

- **Always check which directory you're in** before starting servers
- **Keep main worktree servers stopped** when testing feature worktrees
- **Use different terminal windows** for each worktree to avoid confusion
- **Commit changes** in the feature worktree, then merge to main when ready

