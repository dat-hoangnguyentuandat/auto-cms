# Auto CMS agent protocol

Use this repository when the user asks to turn an ERP task URL into a complete CMS theme. Work until the run is `COMPLETED` or `NEEDS_HUMAN`; do not stop merely after generating code.

## Start

1. Read `README.md`, `mcp-setup.md`, and `read_erp.md`.
2. Run `npm install`, `npm run build`, `npm test`, then `node dist/cli.js doctor` when dependencies or build output are missing.
3. Ensure Edge CDP, MySQL, CMS, and host Stitch MCP are ready.
4. Start:

```powershell
node dist/cli.js run --task-url "<ERP_TASK_URL>"
```

## Action loop

When CLI returns `ACTION_REQUIRED`:

1. Read `action.promptFile` completely.
2. Read every skill `SKILL.md` in `action.skills` completely and follow its references by phase.
3. Write only within `action.allowedWriteRoots` and preserve unrelated user changes.
4. Create every `action.expectedArtifacts` file using real evidence; never fabricate a passing report.
5. Execute `nextCommand` exactly. Continue until a terminal state.

When a validator rejects submission, fix the reported root cause and resubmit within the retry budget. Never edit `run.json`, submission tokens, or validation results manually.

## Safety

- Never store ERP cookies or MCP/API credentials.
- Never run destructive database reset commands.
- Do not modify CMS core during theme ownership stages.
- Do not bypass Stitch, sitemap, QA, SEO, or package gates.
- Ask for human action only for authentication/approval, unsupported external state, production-risk ambiguity, or exhausted retry limits.

## Completion

Report the paths for brief, sitemap, approved design, theme source, QA evidence, final report, and ZIP. A theme source directory without a verified ZIP is incomplete.

<!-- >>> basedkit instructions >>>
# BasedKit Engineer

Use skills from `.agents/skills` when their descriptions match the task.
BasedKit support files are stored under `.codex/basedkit`.

# Development Rules

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT:** You ALWAYS follow these principles: **YAGNI (You Aren't Gonna Need It) - KISS (Keep It Simple, Stupid) - DRY (Don't Repeat Yourself)**

## General
- **File Naming**: Use kebab-case for file names with a meaningful name that describes the purpose of the file, doesn't matter if the file name is long, just make sure when LLMs read the file names while using Grep or other tools, they can understand the purpose of the file right away without reading the file content.
- **File Size Management**: Keep individual code files under 200 lines for optimal context management
  - Split large files into smaller, focused components/modules
  - Use composition over inheritance for complex widgets
  - Extract utility functions into separate modules
  - Create dedicated service classes for business logic
- Use `docs-seeker` skill for exploring latest docs of plugins/packages if needed
- Use `gh` bash command to interact with Github features if needed
- Use `psql` bash command to query Postgres database for debugging if needed
- Use `ai-multimodal` skill for describing details of images, videos, documents, etc. if needed
- Use `ai-multimodal` skill and `imagemagick` skill for generating and editing images, videos, documents, etc. if needed
- Use `sequential-thinking` skill and `debugging` skills for sequential thinking, analyzing code, debugging, etc. if needed
- **[IMPORTANT]** Follow the codebase structure and code standards in `./docs` during implementation.
- **[IMPORTANT]** Do not just simulate the implementation or mocking them, always implement the real code.

## Code Quality Guidelines
- Read and follow codebase structure and code standards in `./docs`
- Don't be too harsh on code linting, but **make sure there are no syntax errors and code are compilable**
- Prioritize functionality and readability over strict style enforcement and code formatting
- Use reasonable code quality standards that enhance developer productivity
- Use try catch error handling & cover security standards
- Use `code-reviewer` for medium/large, security-sensitive, architectural, or explicitly requested reviews. Do not invoke it for trivial changes unless risk warrants it.

## Pre-commit/Push Rules
- Run linting before commit
- Run tests before push (DO NOT ignore failed tests just to pass the build or github actions)
- Keep commits focused on the actual code changes
- **DO NOT** commit and push any confidential information (such as dotenv files, API keys, database credentials, etc.) to git repository!
- Create clean, professional commit messages without AI references. Use conventional commit format.

## Code Implementation
- Write clean, readable, and maintainable code
- Follow established architectural patterns
- Implement features according to specifications
- Handle edge cases and error scenarios
- **DO NOT** create new enhanced files, update to the existing files directly.

# Primary Workflow

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT**: Ensure token efficiency while maintaining high quality.

## Task Sizing And Fast Path

Classify the task before choosing a workflow. Prefer the smallest workflow that safely completes the request.

### Small / Fast-path tasks

Examples: copy changes, CSS alignment or spacing, changing a display limit, a localized template adjustment, renaming a label, a one-file configuration change, or another obvious low-risk edit.

- Work directly without delegating to `planner`, `researcher`, `tester`, `code-reviewer`, `docs-manager`, or `project-manager`.
- Do not create a plan under `./plans`.
- Inspect only the directly relevant files and skill references; do not load an entire documentation set when the selected skill allows phase-specific reading.
- Make the smallest scoped edit.
- Run the fastest relevant validation: syntax/compile check, focused test, rendered/static check, and asset publish/cache clear only when required.
- Do not run the full test suite, package the whole theme, update roadmap/changelog, or perform broad QA unless the change affects those areas or the user asks.
- Target completion in one direct implementation pass. Escalate to the standard workflow only if the task expands, validation fails, or hidden complexity appears.

### Medium tasks

Examples: a multi-file bug fix, an isolated feature, a component refactor, or a change to an API/data contract.

- Use a concise local plan; delegate to `planner` only when dependencies or design choices are non-trivial.
- Run focused tests directly or use `tester` when test analysis is substantial.
- Use `code-reviewer` when the change affects shared behavior, security, data integrity, or backward compatibility.
- Update documentation only when behavior, contracts, operations, or project status materially changes.

### Large / High-risk tasks

Examples: new subsystems, cross-cutting features, architecture changes, migrations, authentication/payment work, production incidents, ERP-to-theme runs, or changes spanning several modules.

- Follow the full Planning → Implementation → Testing → Review workflow.
- Use research, documentation, project management, and parallel agents only where they add concrete value.
- ERP task URL runs always follow the complete Auto CMS protocol and are never eligible for the fast path.

#### 1. Code Implementation
- For large/high-risk work, delegate to `planner` to create an implementation plan with TODO tasks in `./plans`.
- Use researcher agents only for distinct unknowns that require external or deep technical research; do not use them for familiar or localized work.
- Write clean, readable, and maintainable code
- Follow established architectural patterns
- Implement features according to specifications
- Handle edge cases and error scenarios
- **DO NOT** create new enhanced files, update to the existing files directly.
- **[IMPORTANT]** After creating or modifying code file, run compile command/script to check for any compile errors.

#### 2. Testing
- For large/high-risk work, delegate to `tester` to run tests and analyze the summary report. For small/medium work, run the narrowest relevant validation directly.
  The following comprehensive expectations apply when the task introduces or materially changes behavior:
  - Write comprehensive unit tests
  - Ensure high code coverage
  - Test error scenarios
  - Validate performance requirements
- Tests are critical for ensuring code quality and reliability, **DO NOT** ignore failing tests just to pass the build.
- **IMPORTANT:** make sure you don't use fake data, mocks, cheats, tricks, temporary solutions, just to pass the build or github actions.
- **IMPORTANT:** Always fix relevant failing tests and rerun the failed checks. Re-delegate to `tester` only when the task uses the full workflow or test analysis remains non-trivial.

#### 3. Code Quality
- After large/high-risk implementations, delegate to `code-reviewer`. For small fast-path work, perform a direct scoped diff review.
- Follow coding standards and conventions
- Write self-documenting code
- Add meaningful comments for complex logic
- Optimize for performance and maintainability

#### 4. Integration
- Follow the approved plan when the task has one; fast-path tasks do not require a stored plan.
- Ensure seamless integration with existing code
- Follow API contracts precisely
- Maintain backward compatibility
- Document breaking changes
- Delegate to `docs-manager` only for material documentation updates or broad documentation work.

#### 5. Debugging
- Delegate server, CI/CD, intermittent, production, or otherwise complex investigations to `debugger`. Diagnose small reproducible local issues directly.
- Read the summary report from `debugger` agent and implement the fix.
- Use `tester` for substantial regression validation; otherwise run focused tests directly.
- If the `tester` agent reports failed tests, fix them follow the recommendations and repeat from the **Step 2**.

# Orchestration Protocol

#### Sequential Chaining
Chain subagents when tasks have dependencies or require outputs from previous steps:
- **Planning → Implementation → Testing → Review**: Use for feature development
- **Research → Design → Code → Documentation**: Use for new system components
- Each agent completes fully before the next begins
- Pass context and outputs between agents in the chain

#### Parallel Execution
Spawn multiple subagents simultaneously for independent tasks:
- **Code + Tests + Docs**: When implementing separate, non-conflicting components
- **Multiple Feature Branches**: Different agents working on isolated features
- **Cross-platform Development**: iOS and Android specific implementations
- **Careful Coordination**: Ensure no file conflicts or shared resource contention
- **Merge Strategy**: Plan integration points before parallel execution begins

# Project Documentation Management

### Roadmap & Changelog Maintenance
- **Project Roadmap** (`./docs/development-roadmap.md`): Living document tracking project phases, milestones, and progress
- **Project Changelog** (`./docs/project-changelog.md`): Detailed record of all significant changes, features, and fixes
- **System Architecture** (`./docs/system-architecture.md`): Detailed record of all significant changes, features, and fixes
- **Code Standards** (`./docs/code-standards.md`): Detailed record of all significant changes, features, and fixes

### Automatic Updates Required
These automatic documentation updates apply only to material feature, milestone, bug, security, timeline, or scope changes. Small fast-path edits do not require roadmap/changelog updates.

- **After Feature Implementation**: Update roadmap progress status and changelog entries
- **After Major Milestones**: Review and adjust roadmap phases, update success metrics
- **After Bug Fixes**: Document fixes in changelog with severity and impact
- **After Security Updates**: Record security improvements and version updates
- **Weekly Reviews**: Update progress percentages and milestone statuses

### Documentation Triggers
For material project changes, the `project-manager` agent MUST update these documents when:
- A development phase status changes (e.g., from "In Progress" to "Complete")
- Major features are implemented or released
- Significant bugs are resolved or security patches applied
- Project timeline or scope adjustments are made
- External dependencies or breaking changes occur

### Update Protocol
1. **Before Updates**: Always read current roadmap and changelog status
2. **During Updates**: Maintain version consistency and proper formatting
3. **After Updates**: Verify links, dates, and cross-references are accurate
4. **Quality Check**: Ensure updates align with actual implementation progress

### Plans

### Plan Location
Save plans in `./plans` directory with timestamp and descriptive name.

**Format:** `plans/{date}-your-plan-name/` (date format from `$BASEDKIT_PLAN_DATE_FORMAT`)

**Example:** `plans/20251101-1505-authentication-and-profile-implementation/`

#### File Organization

```
plans/
├── 20251101-1505-authentication-and-profile-implementation/
    ├── research/
    │   ├── researcher-XX-report.md
    │   └── ...
│   ├── reports/
│   │   ├── scout-report.md
│   │   ├── researcher-report.md
│   │   └── ...
│   ├── plan.md                                # Overview access point
│   ├── phase-01-setup-environment.md          # Setup environment
│   ├── phase-02-implement-database.md         # Database models
│   ├── phase-03-implement-api-endpoints.md    # API endpoints
│   ├── phase-04-implement-ui-components.md    # UI components
│   ├── phase-05-implement-authentication.md   # Auth & authorization
│   ├── phase-06-implement-profile.md          # Profile page
│   └── phase-07-write-tests.md                # Tests
└── ...
```

#### File Structure

##### Overview Plan (plan.md)
- Keep generic and under 80 lines
- List each phase with status/progress
- Link to detailed phase files
- Key dependencies

##### Phase Files (phase-XX-name.md)
Fully respect the `./docs/development-rules.md` file.
Each phase file should contain:

**Context Links**
- Links to related reports, files, documentation

**Overview**
- Priority
- Current status
- Brief description

**Key Insights**
- Important findings from research
- Critical considerations

**Requirements**
- Functional requirements
- Non-functional requirements

**Architecture**
- System design
- Component interactions
- Data flow

**Related Code Files**
- List of files to modify
- List of files to create
- List of files to delete

**Implementation Steps**
- Detailed, numbered steps
- Specific instructions

**Todo List**
- Checkbox list for tracking

**Success Criteria**
- Definition of done
- Validation methods

**Risk Assessment**
- Potential issues
- Mitigation strategies

**Security Considerations**
- Auth/authorization
- Data protection

**Next Steps**
- Dependencies
- Follow-up tasks

# EasyChatGPT App Debug

When user's message contains any of these:
- `console.easyaichat.app` or `staging.console.easyaichat.app` URLs
- Error messages, stack traces, cURL errors from the app
- Requests to debug, investigate, check conversation, or evaluate app behavior

Then:
1. NEVER use WebFetch/Fetch on console URLs — returns 403 (session auth required)
2. Read `.agents/skills/app-debug/SKILL.md` and follow its instructions
<!-- <<< basedkit instructions <<< -->
