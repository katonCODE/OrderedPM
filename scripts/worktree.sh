#!/bin/bash
# Git worktree helper script
# Usage: ./scripts/worktree.sh <command> [options]

set -e

WORKTREE_DIR="${WORKTREE_DIR:-worktrees}"

case "$1" in
  create)
    if [ -z "$2" ]; then
      echo "Usage: $0 create <branch-name> [base-branch]"
      exit 1
    fi
    BRANCH="$2"
    BASE="${3:-main}"
    WORKTREE_PATH="$WORKTREE_DIR/$BRANCH"
    
    echo "Creating worktree for branch '$BRANCH'..."
    git worktree add -b "$BRANCH" "$WORKTREE_PATH" "$BASE"
    echo "Worktree created at $WORKTREE_PATH"
    echo "To switch to it: cd $WORKTREE_PATH"
    ;;
    
  add)
    if [ -z "$2" ]; then
      echo "Usage: $0 add <branch-name>"
      exit 1
    fi
    BRANCH="$2"
    WORKTREE_PATH="$WORKTREE_DIR/$BRANCH"
    
    echo "Adding worktree for existing branch '$BRANCH'..."
    git worktree add "$WORKTREE_PATH" "$BRANCH"
    echo "Worktree added at $WORKTREE_PATH"
    ;;
    
  remove)
    if [ -z "$2" ]; then
      echo "Usage: $0 remove <branch-name>"
      exit 1
    fi
    BRANCH="$2"
    WORKTREE_PATH="$WORKTREE_DIR/$BRANCH"
    
    echo "Removing worktree for branch '$BRANCH'..."
    git worktree remove "$WORKTREE_PATH"
    echo "Worktree removed"
    ;;
    
  list)
    echo "Current worktrees:"
    git worktree list
    ;;
    
  *)
    echo "Git Worktree Helper"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  create <branch-name> [base-branch]  Create a new branch and worktree"
    echo "  add <branch-name>                   Add worktree for existing branch"
    echo "  remove <branch-name>                Remove a worktree"
    echo "  list                                 List all worktrees"
    echo ""
    echo "Examples:"
    echo "  $0 create feature/new-feature        Create new branch from main"
    echo "  $0 create bugfix/fix-123 develop    Create new branch from develop"
    echo "  $0 add existing-branch              Add worktree for existing branch"
    echo "  $0 remove feature/new-feature       Remove worktree"
    echo "  $0 list                             List all worktrees"
    echo ""
    echo "Note: Set WORKTREE_DIR environment variable to change worktree location"
    echo "      (default: worktrees/)"
    exit 1
    ;;
esac

