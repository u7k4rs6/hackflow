# AutoShip — AI-Native Autonomous Software Execution Engine

AutoShip takes a natural language product idea and autonomously generates, tests, and deploys a working CRUD SaaS application.

## What It Does

1. **Planner Agent** — Converts idea into a structured JSON spec (models, endpoints, features)
2. **Builder Agent** — Generates a complete FastAPI + SQLite application from the spec
3. **QA Agent** — Generates and executes pytest tests against the generated code
4. **Closed-Loop Correction** — If tests fail, sends errors back to Builder for one retry
5. **Ship** — Pushes to GitHub and deploys to Railway/Render (when configured)

## Architecture

```
User Idea → [Planner] → JSON Spec → [Builder] → Source Files → [QA] → Test Results
                                                                          │
                                                         Pass ≥ 80% ──→ Deploy
                                                         Fail ──→ Retry Builder (1x)
```

**3 agents. Sequential pipeline. No recursion. One retry.**

## Tech Stack

| Layer       | Choice                         |
|-------------|--------------------------------|
| Engine      | Node.js + Express              |
| Frontend    | React + Tailwind CSS + Vite    |
| Database    | SQLite (better-sqlite3)        |
| LLM         | OpenAI API (gpt-4o)            |
| Generated   | Python FastAPI + SQLite        |
| Source Push  | GitHub API (Octokit)           |
| Deployment  | Railway or Render              |

## What This MVP Proves

- AI can execute a controlled SDLC loop end-to-end
- Orchestration across planning, building, and testing works
- Closed-loop error correction produces measurable improvement
- Tool usage (GitHub API, deployment APIs) works within the pipeline

## What This MVP Does NOT Prove

- Enterprise-grade autonomy
- Reliability at scale
- Complex architecture reasoning
- Long-term memory or learning across runs

## Intentionally Excluded

- Multi-cloud deployment
- Enterprise compliance (SOC2, HIPAA)
- Complex auth flows (OAuth, SAML)
- File uploads, websockets, real-time features
- Agent hierarchy or recursive loops
- Vector databases or semantic memory
- Kubernetes or distributed systems
- More than 6 models or 20 endpoints per app

## Scope Restrictions

- **Apps**: CRUD SaaS only
- **Generated stack**: Python FastAPI + SQLite
- **Database**: SQLite (no Postgres, MySQL, MongoDB)
- **Deploy target**: Single platform (Railway or Render)
- **Retry policy**: Maximum 1 retry cycle
- **Test threshold**: 80% pass rate required for deployment

## Configuration

Set keys via environment variables or the Settings UI:

| Key              | Required | Description                        |
|------------------|----------|------------------------------------|
| OPENAI_API_KEY   | Yes      | OpenAI API key (gpt-4o recommended)|
| GITHUB_TOKEN     | No       | GitHub PAT with `repo` scope       |
| RAILWAY_TOKEN    | No       | Railway API token                  |
| RENDER_API_KEY   | No       | Render API key                     |

## API Endpoints

### Pipeline
- `POST /api/pipeline/run` — Start pipeline with `{ idea: string }`
- `GET /api/pipeline/status/:id` — Get project status + logs
- `GET /api/pipeline/logs/:id` — Get pipeline log stream
- `POST /api/pipeline/cancel/:id` — Cancel running pipeline

### Projects
- `GET /api/projects` — List all projects
- `GET /api/projects/:id` — Get project details
- `GET /api/projects/:id/files` — List generated files
- `GET /api/projects/:id/file/*` — Get file content
- `GET /api/projects/:id/download` — Download as ZIP
- `DELETE /api/projects/:id` — Delete project

### Settings
- `GET /api/settings` — Get current settings
- `PUT /api/settings` — Update settings
- `GET /api/settings/status` — Check integration status

## Demo Script (3 minutes)

1. **[0:00]** Open AutoShip dashboard. Show the Launch page.
2. **[0:15]** Enter: "Build a task management app with user authentication"
3. **[0:20]** Click Launch. Watch the pipeline stages execute in real-time.
4. **[0:45]** Planner completes — show the generated JSON spec with models and endpoints.
5. **[1:15]** Builder completes — show the generated file list in the Files tab.
6. **[1:45]** QA runs — show test results with pass percentage.
7. **[2:00]** If retry triggers, show the correction loop in action.
8. **[2:15]** Show GitHub repo created (if token configured).
9. **[2:30]** Show deployment URL (if platform configured).
10. **[2:45]** Open the live deployed app — show the API docs at `/docs`.
11. **[3:00]** Recap: "One idea. Three agents. Working deployed app."

## Time Allocation

| Day | Focus                              |
|-----|-------------------------------------|
| 1   | Orchestrator + Planner Agent        |
| 2   | Builder Agent + GitHub automation   |
| 3   | QA Agent + Deployment + Frontend    |