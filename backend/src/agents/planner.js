import { llmJsonCall } from '../services/llm.js';
import { addLog } from '../services/database.js';

const SYSTEM_PROMPT = `You are the Planner Agent for AutoShip, an AI software execution engine.
Your job: convert a natural language product idea into a precise JSON specification for a CRUD SaaS application.

CONSTRAINTS:
- Only CRUD operations (Create, Read, Update, Delete)
- Target stack: Python FastAPI + SQLite
- No complex auth flows — use simple token-based auth if auth is requested
- No file uploads, websockets, or real-time features
- Maximum 6 database models
- Maximum 20 API endpoints
- Keep it simple and buildable

OUTPUT FORMAT (strict JSON):
{
  "app_name": "string — snake_case app name",
  "display_name": "string — human readable name",
  "description": "string — one line description",
  "models": [
    {
      "name": "string — PascalCase model name",
      "table_name": "string — snake_case table name",
      "fields": [
        {
          "name": "string — snake_case field name",
          "type": "string | integer | float | boolean | text | datetime",
          "required": true,
          "unique": false,
          "default": null
        }
      ],
      "relationships": [
        {
          "type": "belongs_to | has_many",
          "model": "string — related model name",
          "foreign_key": "string"
        }
      ]
    }
  ],
  "endpoints": [
    {
      "method": "GET | POST | PUT | DELETE",
      "path": "/api/resource",
      "description": "string",
      "model": "string — which model this operates on",
      "operation": "create | read_one | read_all | update | delete | custom",
      "auth_required": true
    }
  ],
  "features": [
    "string — high level feature descriptions"
  ],
  "has_auth": true,
  "auth_model": "User | null"
}

RULES:
- Every model MUST have an 'id' field (integer, auto-increment primary key) — do NOT include it in the fields array, it's implicit
- Every model MUST have 'created_at' and 'updated_at' datetime fields — do NOT include them, they're implicit
- If auth is needed, include a User model with email, password_hash, and name fields
- Generate standard CRUD endpoints for every model
- Add list endpoints with basic filtering
- Foreign key fields should be named {model_name}_id
- Return ONLY valid JSON, no markdown, no explanation`;

export async function runPlanner(projectId, idea) {
  addLog(projectId, 'planner', 'running', 'Starting planner agent');

  const userPrompt = `Product Idea: ${idea}

Analyze this idea and generate a complete CRUD SaaS application specification. Be practical — include only what's needed for a working MVP. If authentication is mentioned or implied, include it. Keep models and endpoints minimal but functional.`;

  try {
    const spec = await llmJsonCall(SYSTEM_PROMPT, userPrompt);

    validate(spec);

    addLog(projectId, 'planner', 'success', 'Spec generated successfully', {
      models: spec.models.length,
      endpoints: spec.endpoints.length,
      has_auth: spec.has_auth,
    });

    return { success: true, spec };
  } catch (err) {
    addLog(projectId, 'planner', 'error', `Planner failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

function validate(spec) {
  const required = ['app_name', 'display_name', 'models', 'endpoints'];
  for (const field of required) {
    if (!spec[field]) {
      throw new Error(`Planner output missing required field: ${field}`);
    }
  }

  if (!Array.isArray(spec.models) || spec.models.length === 0) {
    throw new Error('Planner must generate at least one model');
  }

  if (spec.models.length > 6) {
    throw new Error(`Too many models (${spec.models.length}). Maximum is 6.`);
  }

  if (!Array.isArray(spec.endpoints) || spec.endpoints.length === 0) {
    throw new Error('Planner must generate at least one endpoint');
  }

  if (spec.endpoints.length > 20) {
    throw new Error(`Too many endpoints (${spec.endpoints.length}). Maximum is 20.`);
  }

  for (const model of spec.models) {
    if (!model.name || !model.fields || !Array.isArray(model.fields)) {
      throw new Error(`Invalid model definition: ${JSON.stringify(model).substring(0, 100)}`);
    }
  }

  for (const endpoint of spec.endpoints) {
    if (!endpoint.method || !endpoint.path) {
      throw new Error(`Invalid endpoint definition: ${JSON.stringify(endpoint).substring(0, 100)}`);
    }
  }
}