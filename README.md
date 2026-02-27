# Project Tree

Small CLI to print directory structures in tree format.

## Install

```bash
npm install
npm link
```

After linking, these commands are available:

```bash
project-tree
ptree
```

## Quick Usage

```bash
# Interactive mode
project-tree

# Print any directory (relative or absolute)
project-tree ../another-folder
ptree "C:/Users/you/Documents/project"

# Multiple targets
project-tree ./src ./tests

# Comma-separated targets (compatibility)
project-tree --paths "./src,./tests"

# One-time excludes
project-tree . --exclude "dist,coverage"

# Include node_modules/.git too
project-tree . --no-default-ignores
```

## Saved Excludes (JSON Config)

Saved excludes are stored in your user config directory by default:

- Windows: `%APPDATA%\\project-tree\\config.json`
- Linux/macOS (XDG): `$XDG_CONFIG_HOME/project-tree/config.json`
- Linux/macOS (fallback): `~/.config/project-tree/config.json`

Example config:

```json
{
  "savedExcludes": ["dist", "coverage"]
}
```

Manage saved excludes:

```bash
project-tree --add-saved-excludes "dist,coverage"
project-tree --remove-saved-excludes "coverage"
project-tree --set-saved-excludes "dist,build"
project-tree --clear-saved-excludes
project-tree --list-saved-excludes
```

Use a custom config location:

```bash
project-tree --config "./config/tree.json" --list-saved-excludes
```

If you prefer project-local config:

```bash
project-tree --config ".project-tree.json" --add-saved-excludes "dist,coverage"
```

## Behavior Summary

- Default ignores are enabled: `node_modules`, `.git`.
- Final excludes are merged from:
  - Default ignores (unless `--no-default-ignores`)
  - Saved excludes from config
  - One-time excludes from `--exclude`
