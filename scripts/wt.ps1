<#
.SYNOPSIS
  Manage sibling git worktrees for parallel work. Works in Windows PowerShell 5.1 and PowerShell 7.
.EXAMPLE
  .\scripts\wt.ps1 new feature-x          # ../northstar-wt-feature-x on new branch feature-x, runs npm ci
  .\scripts\wt.ps1 new feature-x -SkipInstall
  .\scripts\wt.ps1 list
  .\scripts\wt.ps1 remove feature-x       # refuses if uncommitted changes; keeps the branch
#>
param(
  [Parameter(Position = 0)][string]$Command = 'list',
  [Parameter(Position = 1)][string]$Branch,
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
  $root = (& git rev-parse --show-toplevel) 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $root) { throw 'Not inside a git repository.' }
  return ($root -replace '/', '\')
}

function Get-WtPath([string]$root, [string]$name) {
  $safe = $name -replace '[\\/]', '-'
  $parent = Split-Path -Parent $root
  return (Join-Path $parent "northstar-wt-$safe")
}

switch ($Command) {
  'new' {
    if (-not $Branch) { throw 'Usage: wt.ps1 new <branch> [-SkipInstall]' }
    $root = Get-RepoRoot
    $path = Get-WtPath $root $Branch
    if (Test-Path $path) { throw "Path already exists: $path" }
    & git -C $root worktree add $path -b $Branch
    if ($LASTEXITCODE -ne 0) { throw 'git worktree add failed.' }
    if (-not $SkipInstall) {
      Push-Location $path
      try { & npm ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' } } finally { Pop-Location }
    } else {
      Write-Host 'Skipped npm ci (-SkipInstall).'
    }
    Write-Host "Worktree ready: $path"
  }
  'list' {
    $root = Get-RepoRoot
    & git -C $root worktree list
  }
  'remove' {
    if (-not $Branch) { throw 'Usage: wt.ps1 remove <branch>' }
    $root = Get-RepoRoot
    $path = Get-WtPath $root $Branch
    if (-not (Test-Path $path)) { throw "No worktree at: $path" }
    $dirty = & git -C $path status --porcelain
    if ($dirty) { throw "Refusing to remove: uncommitted changes in $path`n$($dirty -join "`n")" }
    # Remove a node_modules junction (if any) without following it.
    $nm = Join-Path $path 'node_modules'
    if ((Test-Path $nm) -and ((Get-Item $nm -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
      & cmd /c rmdir "`"$nm`""
    }
    & git -C $root worktree remove $path
    if ($LASTEXITCODE -ne 0) { throw 'git worktree remove failed (installed node_modules or locked files? close editors and retry, or use: git worktree remove --force <path> after checking).' }
    Write-Host "Removed worktree $path (branch '$Branch' kept; delete with: git branch -d $Branch)"
  }
  default { throw "Unknown command '$Command'. Use: new <branch> | list | remove <branch>" }
}
