# Git Worktrees Guide

This repository is set up to use Git worktrees, which allow you to have multiple working directories for different branches simultaneously.

## What are Git Worktrees?

Git worktrees let you check out multiple branches of the same repository in separate directories. This is useful when you need to:
- Work on multiple features simultaneously
- Test different branches without switching
- Keep a clean main branch while working on experimental features

## Setup

The repository is already configured for worktrees:
- `.gitignore` includes patterns for worktree directories (`*-worktree/`, `worktrees/`)
- Helper scripts are available in `scripts/` directory

## Quick Start

### Using Helper Scripts

**Windows (PowerShell):**
```powershell
# Create a new branch and worktree
.\scripts\worktree.ps1 create feature/new-feature

# Create from a different base branch
.\scripts\worktree.ps1 create bugfix/fix-123 develop

# Add worktree for existing branch
.\scripts\worktree.ps1 add existing-branch

# Remove a worktree
.\scripts\worktree.ps1 remove feature/new-feature

# List all worktrees
.\scripts\worktree.ps1 list
```

**Linux/Mac (Bash):**
```bash
# Make script executable (first time only)
chmod +x scripts/worktree.sh

# Create a new branch and worktree
./scripts/worktree.sh create feature/new-feature

# Create from a different base branch
./scripts/worktree.sh create bugfix/fix-123 develop

# Add worktree for existing branch
./scripts/worktree.sh add existing-branch

# Remove a worktree
./scripts/worktree.sh remove feature/new-feature

# List all worktrees
./scripts/worktree.sh list
```

### Manual Git Commands

If you prefer to use git commands directly:

```bash
# Create a new branch and worktree
git worktree add -b feature/new-feature worktrees/feature-new-feature main

# Add worktree for existing branch
git worktree add worktrees/existing-branch existing-branch

# List all worktrees
git worktree list

# Remove a worktree
git worktree remove worktrees/feature-new-feature
```

## Workflow Example

1. **Create a worktree for a new feature:**
   ```powershell
   .\scripts\worktree.ps1 create feature/user-authentication
   ```

2. **Navigate to the worktree:**
   ```powershell
   cd worktrees\feature-user-authentication
   ```

3. **Work on your feature** - make changes, commit, push as normal

4. **When done, remove the worktree:**
   ```powershell
   cd ..\..
   .\scripts\worktree.ps1 remove feature/user-authentication
   ```

## Customizing Worktree Location

By default, worktrees are created in the `worktrees/` directory. You can change this by setting the `WORKTREE_DIR` environment variable:

**Windows (PowerShell):**
```powershell
$env:WORKTREE_DIR = "my-worktrees"
.\scripts\worktree.ps1 create feature/test
```

**Linux/Mac (Bash):**
```bash
export WORKTREE_DIR="my-worktrees"
./scripts/worktree.sh create feature/test
```

## Important Notes

- Worktrees share the same `.git` directory, so they're all part of the same repository
- Each worktree can be on a different branch
- You can have multiple worktrees, but each branch can only be checked out in one worktree at a time
- Worktree directories are ignored by git (via `.gitignore`)
- Always remove worktrees using `git worktree remove` or the helper script - don't just delete the directory

## Troubleshooting

**Error: "fatal: 'worktrees/...' is a missing but locked worktree"**
- This usually means a worktree was deleted manually. Run `git worktree prune` to clean up.

**Error: "fatal: 'branch-name' is already checked out"**
- The branch is already checked out in another worktree. Either switch to that worktree or remove it first.

**Want to see all worktrees?**
```bash
git worktree list
```

