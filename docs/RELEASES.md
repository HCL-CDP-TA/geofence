# Release and Publishing Guide

This document explains how releases and npm publishing work in this monorepo.

## Overview

This monorepo uses **release-please** in manifest mode to manage independent versioning and releases for each package:

- **packages/sdk** - Published to npm as `@hcl-cdp-ta/geofence-sdk`
- **packages/admin** - Private Next.js app (not published to npm)

Each package has its own version number and releases independently based on which files are changed.

## How It Works

### 1. Conventional Commits

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat:` - New feature (triggers minor version bump)
- `fix:` - Bug fix (triggers patch version bump)
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Adding tests

**Scopes** (optional but recommended):
- `sdk` - Changes to packages/sdk
- `admin` - Changes to packages/admin

**Examples:**
```bash
git commit -m "feat(sdk): add server-side evaluation mode"
git commit -m "fix(admin): correct geofence form validation"
git commit -m "docs: update README with new examples"
```

### 2. Release-Please Monitors Changes

When you push to `main`:

1. **Release-please analyzes commits** since the last release for each package
2. **Detects which packages changed** based on file paths in commits
3. **Creates release PRs** for packages with changes:
   - SDK changes → "chore(sdk): release @hcl-cdp-ta/geofence-sdk X.Y.Z"
   - Admin changes → "chore(admin): release admin X.Y.Z"
   - Both changed → Two separate PRs (due to `separate-pull-requests: true`)

### 3. Release PR Contents

Each release PR includes:
- Version bump in `package.json`
- Updated `CHANGELOG.md` with new changes
- Updated `.release-please-manifest.json`

**You review the PR** to verify:
- Version bump is correct (patch/minor/major)
- Changelog accurately reflects changes
- No unintended changes included

### 4. Merge Creates Release

When you merge a release PR:

1. **GitHub Release created** with tag:
   - SDK: `@hcl-cdp-ta/geofence-sdk-vX.Y.Z`
   - Admin: `admin-vX.Y.Z`

2. **Automatic publishing** (SDK only):
   - If SDK was released → `publish-sdk` job runs automatically
   - Installs dependencies, builds SDK, publishes to npm
   - Admin releases do NOT trigger npm publish

## Complete Workflow Example

### Scenario: Fix SDK Bug

**Step 1: Make changes**
```bash
# Edit the SDK
vim packages/sdk/src/utils/distance.ts

# Stage changes
git add packages/sdk/src/utils/distance.ts

# Commit with conventional format
git commit -m "fix(sdk): correct haversine formula for distances >1000km"

# Push to main
git push origin main
```

**Step 2: Release-please creates PR**
- GitHub Action runs automatically
- Detects SDK change (only `packages/sdk/` files modified)
- Creates PR: "chore(sdk): release @hcl-cdp-ta/geofence-sdk 1.0.9"
- PR shows version bump: 1.0.8 → 1.0.9 (patch bump for `fix:`)

**Step 3: Review and merge PR**
- Review the changelog in the PR
- Merge when ready

**Step 4: Automatic release and publish**
- Tag created: `@hcl-cdp-ta/geofence-sdk-v1.0.9`
- GitHub release created with changelog
- `publish-sdk` job runs:
  1. `npm install` - Install dependencies
  2. `npm run build -w @hcl-cdp-ta/geofence-sdk` - Build SDK
  3. `npm publish --access public --provenance` - Publish to npm
- **SDK now live on npm**: `@hcl-cdp-ta/geofence-sdk@1.0.9`

### Scenario: Update Admin Only

**Step 1: Make changes**
```bash
# Edit admin
vim packages/admin/app/page.tsx

git add packages/admin/app/page.tsx
git commit -m "feat(admin): add dark mode toggle to dashboard"
git push origin main
```

**Step 2: Release-please creates PR**
- Detects admin change (only `packages/admin/` files modified)
- Creates PR: "chore(admin): release admin 1.0.9"
- SDK stays at 1.0.9 (unchanged)

**Step 3: Merge PR**
- Tag created: `admin-v1.0.9`
- GitHub release created
- **No npm publish** (admin is private)

### Scenario: Update Both Packages

**Step 1: Make changes affecting both**
```bash
# Add feature that touches both packages
vim packages/sdk/src/types.ts
vim packages/admin/app/api/geofences/route.ts

git add packages/sdk/src/types.ts packages/admin/app/api/geofences/route.ts
git commit -m "feat: add geofence metadata support"
git push origin main
```

**Step 2: Release-please creates TWO PRs**
- PR 1: "chore(sdk): release @hcl-cdp-ta/geofence-sdk 1.0.10"
- PR 2: "chore(admin): release admin 1.0.10"

**Step 3: Merge both PRs**
- Two releases created
- SDK published to npm
- Admin not published

**Result:**
- SDK: 1.0.9 → 1.0.10 (published to npm)
- Admin: 1.0.9 → 1.0.10 (GitHub release only)

## Version Bumping Rules

Release-please determines version bumps based on commit types:

| Commit Type | Version Bump | Example |
|------------|--------------|---------|
| `fix:` | Patch (1.0.0 → 1.0.1) | Bug fixes |
| `feat:` | Minor (1.0.0 → 1.1.0) | New features |
| `BREAKING CHANGE:` | Major (1.0.0 → 2.0.0) | Breaking changes |
| `docs:`, `chore:` | No bump | Documentation only |

**Breaking changes:**
```bash
git commit -m "feat(sdk)!: remove deprecated methods

BREAKING CHANGE: The `oldMethod()` has been removed. Use `newMethod()` instead."
```

This will bump SDK from 1.x.x → 2.0.0

## Configuration Files

### `.github/workflows/release-please.yml`
Main workflow file with two jobs:
1. **release-please** - Creates/updates release PRs
2. **publish-sdk** - Publishes SDK to npm (only runs for SDK releases)

### `release-please-config.json`
Configures release-please behavior:
```json
{
  "packages": {
    "packages/sdk": {
      "release-type": "node",
      "package-name": "@hcl-cdp-ta/geofence-sdk",
      "include-v-in-tag": true
    },
    "packages/admin": { ... }
  },
  "separate-pull-requests": true
}
```

**Key settings:**
- `release-type: "node"` - Uses Node.js versioning (package.json)
- `include-v-in-tag: true` - Tags like `v1.0.9` not `1.0.9`
- `separate-pull-requests: true` - One PR per package
- `changelog-sections` - What commit types appear in changelog

### `.release-please-manifest.json`
Tracks current version of each package:
```json
{
  "packages/sdk": "1.0.8",
  "packages/admin": "1.0.8"
}
```

**Updated automatically** by release-please PRs.

## Troubleshooting

### Release PR not created

**Check:**
1. Are you using conventional commit format?
2. Did you push to `main` branch?
3. Are there commits since the last release?
4. Check GitHub Actions tab for errors

**Common issues:**
- Commit without type prefix (use `fix:` or `feat:`)
- Only touched files outside `packages/` (no release needed)
- Only `chore:` or `docs:` commits (don't trigger version bumps)

### Wrong package released

Release-please uses **file paths** to determine which package changed:
- Changes to `packages/sdk/**` → SDK release
- Changes to `packages/admin/**` → Admin release

**Solution:**
- Ensure commits touch the correct package directories
- Check release PR to see what files were included

### Publish failed

**Check:**
1. `NPM_TOKEN` secret is configured in GitHub repo settings
2. Token has publish permissions for `@hcl-cdp-ta` scope
3. Version doesn't already exist on npm (can't republish same version)

**View logs:**
- Go to GitHub Actions tab
- Click the failed workflow run
- Check "Publish SDK to npm" step logs

### Lock file out of sync

**Error:** `npm ci` fails with "Missing: @hcl-cdp-ta/geofence-sdk@X.Y.Z from lock file"

**Cause:** Release-please updates `package.json` versions but doesn't automatically update the root `package-lock.json`.

**Solution 1 (Automatic - Recommended):**
The `.github/workflows/update-lockfile.yml` workflow automatically updates the lock file on release PRs. Just wait for it to commit, then merge the PR.

**Solution 2 (Manual - If workflow disabled):**
After merging a release PR:
```bash
git pull origin main
npm install
git add package-lock.json
git commit -m "chore: update lock file after release"
git push origin main
```

**Note:** The publish workflow now uses `npm install` instead of `npm ci` to handle this automatically, but keeping the lock file in sync is still good practice.

### Need to skip CI

If you need to push without triggering releases:
```bash
git commit -m "chore: update docs [skip ci]"
```

The `[skip ci]` flag prevents the workflow from running.

## Manual Publishing (Emergency Only)

If you need to publish manually:

```bash
# From repository root
npm install
npm run build -w @hcl-cdp-ta/geofence-sdk
cd packages/sdk
npm publish --access public
cd ../..
```

**You'll need:**
- npm logged in (`npm login`)
- Publish permissions for `@hcl-cdp-ta` scope

**When to use:**
- GitHub Actions is down
- Need to quickly fix a critical npm package issue
- Testing publishing process locally

## Best Practices

### DO:
✅ Use conventional commit format consistently
✅ Include scope (`sdk`, `admin`) to clarify changes
✅ Write clear, descriptive commit messages
✅ Review release PRs before merging
✅ Let automation handle publishing

### DON'T:
❌ Manually edit version in `package.json`
❌ Create tags manually
❌ Skip release PRs and push directly
❌ Publish to npm manually (except emergencies)
❌ Merge multiple unrelated features in one commit

## FAQ

**Q: Can I control which package gets released?**
A: Yes, through file paths. Only packages with modified files get releases.

**Q: What if I make a mistake in a release?**
A: You can publish a new patch version with the fix. npm doesn't allow unpublishing or overwriting versions.

**Q: Can admin and SDK have different version numbers?**
A: Yes! They version independently. SDK might be 1.2.5 while admin is 1.1.3.

**Q: How do I make a breaking change?**
A: Use `!` after type or add `BREAKING CHANGE:` in commit footer:
```bash
git commit -m "feat(sdk)!: remove old API"
# or
git commit -m "feat(sdk): new API

BREAKING CHANGE: Removed oldMethod()"
```

**Q: Can I test the release process?**
A: Yes, create a feature branch and see what release-please would do (it only runs on `main` though).

**Q: Where are SDK packages published?**
A: npm registry at https://www.npmjs.com/package/@hcl-cdp-ta/geofence-sdk

**Q: How do I see what version is currently released?**
A: Check `.release-please-manifest.json` or `packages/sdk/package.json`

## Related Documentation

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Release-Please Documentation](https://github.com/googleapis/release-please)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)

## Quick Reference

```bash
# Make SDK fix
git commit -m "fix(sdk): description"
→ SDK 1.0.8 → 1.0.9 (patch) → Published to npm

# Make SDK feature
git commit -m "feat(sdk): description"
→ SDK 1.0.8 → 1.1.0 (minor) → Published to npm

# Make SDK breaking change
git commit -m "feat(sdk)!: description"
→ SDK 1.0.8 → 2.0.0 (major) → Published to npm

# Make admin change
git commit -m "feat(admin): description"
→ Admin 1.0.8 → 1.1.0 → GitHub release only (no npm)

# Non-versioning changes
git commit -m "docs: update readme"
→ No release (docs don't bump versions)
```
