# Git Workflow and Conventions

This document outlines the branching strategy, commit message conventions, and merge process for the Transcendence project.

## Branch Naming Conventions

All new branches must start with one of the following prefixes, followed by a descriptive name in lowercase with hyphens as separators:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `docs/` | Documentation updates | `docs/setup_instructions` |
| `feature/` | New features | `feature/user_authentication` |
| `fix/` | Bug fixes | `fix/login_validation_error` |
| `chore/` | Maintenance tasks, dependencies | `chore/update_dependencies` |
| `test/` | Tests and test improvements | `test/add_api_coverage` |
| `refactor/` | Code refactoring | `refactor/simplify_auth_logic` |

### Branch Naming Rules

- Use lowercase letters, numbers, and underscores only
- Be descriptive and concise (aim for 2-5 words)
- Avoid special characters
- Maximum length: 50 characters

## Commit Message Conventions

Write clear and descriptive commit messages that explain what you have worked on and why. It should serve as a helper for your reviewer as well. Make sure the message can be understood without any knowledge of the subcontext. Optimally when your commit contains changes to multiple areas of the project. The changes should be described for all parts separately.

## Keep the max. 200 lines per commit rule-of-thumb in mind!

Unless it can be well reasoned to do otherwise, 42 has the rule for max 200 lines of code per commit. Some cases contain much more than this, but most of those cases should not be code (docs, config files etc.). So whenever you are commiting code, keep it around 200 lines! 

### Examples

```
fix: prevent race condition on user login

Add mutex lock to prevent simultaneous login attempts
on the same user account.
```

```
docs: update installation steps for docker setup
```

## Merge and Pull Request Process

### Before Creating a Pull Request

1. Ensure your branch is up-to-date with `main`
2. Run all tests locally and verify they pass. Any merge to main, that breaks functionality should be reverted and fixed.
3. Review your own code changes before requesting review
4. Ensure commit messages follow the conventions above

### Creating a Pull Request

1. Push your branch to the repository
2. Open a pull request with a clear title and description
3. Reference any related issues using `#issue-number`

### Code Review and Approval

- Every pull request requires **at least 1 review** before merging
- Address feedback and make necessary updates
- Push additional commits to the same branch (don't rebase/force push)
- Re-request review after making changes, if they were requested.

## Best Practices

- Create branches early and push regularly
- Keep branches focused on a single concern
- Sync with `main` frequently to avoid large merge conflicts
- Review your own code before requesting others' time
- Communicate in PR descriptions or whatsapp if anything is unclear

## If you think you need to do something that would go out of the rules, please discuss it with the team first.
