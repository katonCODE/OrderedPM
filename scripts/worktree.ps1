# Git worktree helper script for PowerShell
# Usage: .\scripts\worktree.ps1 <command> [options]

param(
    [Parameter(Mandatory=$true)]
    [string]$Command,
    
    [Parameter(Mandatory=$false)]
    [string]$BranchName,
    
    [Parameter(Mandatory=$false)]
    [string]$BaseBranch = "main"
)

$ErrorActionPreference = "Stop"
$WorktreeDir = if ($env:WORKTREE_DIR) { $env:WORKTREE_DIR } else { "worktrees" }

function Show-Help {
    Write-Host "Git Worktree Helper" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\scripts\worktree.ps1 <command> [options]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  create <branch-name> [base-branch]  Create a new branch and worktree"
    Write-Host "  add <branch-name>                   Add worktree for existing branch"
    Write-Host "  remove <branch-name>                Remove a worktree"
    Write-Host "  list                                 List all worktrees"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\scripts\worktree.ps1 create feature/new-feature"
    Write-Host "  .\scripts\worktree.ps1 create bugfix/fix-123 develop"
    Write-Host "  .\scripts\worktree.ps1 add existing-branch"
    Write-Host "  .\scripts\worktree.ps1 remove feature/new-feature"
    Write-Host "  .\scripts\worktree.ps1 list"
    Write-Host ""
    Write-Host "Note: Set WORKTREE_DIR environment variable to change worktree location"
    Write-Host "      (default: worktrees/)"
}

switch ($Command.ToLower()) {
    "create" {
        if (-not $BranchName) {
            Write-Host "Error: Branch name is required" -ForegroundColor Red
            Show-Help
            exit 1
        }
        $WorktreePath = Join-Path $WorktreeDir $BranchName
        
        Write-Host "Creating worktree for branch '$BranchName'..." -ForegroundColor Yellow
        git worktree add -b $BranchName $WorktreePath $BaseBranch
        Write-Host "Worktree created at $WorktreePath" -ForegroundColor Green
        Write-Host "To switch to it: cd $WorktreePath" -ForegroundColor Cyan
    }
    
    "add" {
        if (-not $BranchName) {
            Write-Host "Error: Branch name is required" -ForegroundColor Red
            Show-Help
            exit 1
        }
        $WorktreePath = Join-Path $WorktreeDir $BranchName
        
        Write-Host "Adding worktree for existing branch '$BranchName'..." -ForegroundColor Yellow
        git worktree add $WorktreePath $BranchName
        Write-Host "Worktree added at $WorktreePath" -ForegroundColor Green
    }
    
    "remove" {
        if (-not $BranchName) {
            Write-Host "Error: Branch name is required" -ForegroundColor Red
            Show-Help
            exit 1
        }
        $WorktreePath = Join-Path $WorktreeDir $BranchName
        
        Write-Host "Removing worktree for branch '$BranchName'..." -ForegroundColor Yellow
        git worktree remove $WorktreePath
        Write-Host "Worktree removed" -ForegroundColor Green
    }
    
    "list" {
        Write-Host "Current worktrees:" -ForegroundColor Cyan
        git worktree list
    }
    
    default {
        Show-Help
        exit 1
    }
}

