# Install script for Ekosistem Edho Ferdian (EEF) — copies skills/*/ into
# ~/.claude/skills/. Run from a cloned copy of this repo.
#
# Usage:
#   .\install.ps1                          # install all 33 skills
#   .\install.ps1 -Only code-review-edho-ferdian,dev-kickoff-edho-ferdian
#                                           # install only the named skills
#   .\install.ps1 -ListOnly                # list installable skill names and exit

param(
    [string[]]$Only = @(),
    [switch]$ListOnly
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillsSrc = Join-Path $ScriptDir "skills"
$TargetDir = if ($env:CLAUDE_SKILLS_DIR) { $env:CLAUDE_SKILLS_DIR } else { Join-Path $HOME ".claude\skills" }

if (-not (Test-Path $SkillsSrc)) {
    Write-Error "Error: $SkillsSrc not found. Run this script from the repo root."
    exit 1
}

$allSkills = Get-ChildItem -Path $SkillsSrc -Directory | Select-Object -ExpandProperty Name | Sort-Object

if ($ListOnly) {
    $allSkills | ForEach-Object { Write-Host $_ }
    exit 0
}

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

$names = if ($Only.Count -gt 0) { $Only } else { $allSkills }

$installed = 0
foreach ($name in $names) {
    $src = Join-Path $SkillsSrc $name
    if (-not (Test-Path $src)) {
        Write-Warning "Skip: no such skill '$name'"
        continue
    }
    $dest = Join-Path $TargetDir $name
    if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
    Copy-Item -Recurse -Path $src -Destination $dest
    Write-Host "Installed: $name -> $dest"
    $installed++
}

Write-Host ""
Write-Host "Done. $installed skill(s) installed to $TargetDir"
