import { llmCall } from '../services/llm.js';
import { addLog } from '../services/database.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filenameLocal = fileURLToPath(import.meta.url);
const __dirnameLocal = dirname(__filenameLocal);
const WORKSPACES_DIR = join(__dirnameLocal, '..', '..', 'workspaces');

const SYSTEM_PROMPT = `You are the QA Agent for AutoShip, an AI software execution engine.
Your job: generate comprehensive pytest unit tests for a FastAPI + SQLite application.

You are given the application specification and the generated source files.

OUTPUT FORMAT:
Return ONLY a JSON object where keys are test file paths and values are file contents.
No markdown, no explanation outside the JSON.

{
  "tests/test_main.py": "file contents...",
  "tests/conftest.py": "file contents..."
}

TEST RULES:
1. Use pytest and httpx (TestClient from fastapi.testclient)
2. Tests must be self-contained — create their own test data
3. Test ALL CRUD endpoints for every model
4. Test validation (missing required fields, wrong types)
5. Test 404 responses for non-existent resources
6. If auth exists: test register, login, protected endpoints, unauthorized access
7. Use conftest.py for shared fixtures (app client, test database override)
8. Override the database to use a separate test.db or in-memory SQLite
9. Clean up test data between tests
10. Each test function must have a clear descriptive name
11. Import paths must match the actual source file structure
12. Tests must be runnable with: pytest tests/ -v

CRITICAL:
- The test database must be isolated from production
- Import the FastAPI app from main.py
- Use TestClient (from fastapi.testclient import TestClient)
- All assertions must be meaningful
- Generate at LEAST 3 tests per model (create, read, delete minimum)
- If auth exists, helper functions must register a user and return a token for authenticated tests
- Do NOT use async tests — use synchronous TestClient`;

export async function runQA(projectId, spec, generatedFiles) {
  addLog(projectId, 'qa', 'running', 'Starting QA agent — generating tests');

  const filesSummary = {};
  for (const [path, content] of Object.entries(generatedFiles)) {
    filesSummary[path] = content;
  }

  const userPrompt = `APPLICATION SPECIFICATION:
${JSON.stringify(spec, null, 2)}

GENERATED SOURCE FILES:
${JSON.stringify(filesSummary, null, 2)}

Generate comprehensive pytest tests for this application. Cover all CRUD operations and edge cases. Make sure imports match the actual file structure above.`;

  try {
    const raw = await llmCall(SYSTEM_PROMPT, userPrompt, { maxTokens: 12000, json: true });
    const testFiles = parseTestFiles(raw);

    addLog(projectId, 'qa', 'success', `Generated ${Object.keys(testFiles).length} test file(s)`, {
      files: Object.keys(testFiles),
    });

    return { success: true, testFiles };
  } catch (err) {
    addLog(projectId, 'qa', 'error', `QA test generation failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

export async function executeTests(projectId, generatedFiles, testFiles) {
  addLog(projectId, 'qa', 'running', 'Setting up workspace and running tests');

  const workspaceId = uuid();
  const workspacePath = join(WORKSPACES_DIR, workspaceId);

  try {
    await mkdir(workspacePath, { recursive: true });

    for (const [filePath, content] of Object.entries(generatedFiles)) {
      const fullPath = join(workspacePath, filePath);
      const dir = dirname(fullPath);
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, content, 'utf-8');
    }

    for (const [filePath, content] of Object.entries(testFiles)) {
      const fullPath = join(workspacePath, filePath);
      const dir = dirname(fullPath);
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, content, 'utf-8');
    }

    const testsInit = join(workspacePath, 'tests', '__init__.py');
    if (!existsSync(testsInit)) {
      await writeFile(testsInit, '', 'utf-8');
    }
    const rootInit = join(workspacePath, '__init__.py');
    if (!existsSync(rootInit)) {
      await writeFile(rootInit, '', 'utf-8');
    }
    const routersInit = join(workspacePath, 'routers', '__init__.py');
    const routersDir = join(workspacePath, 'routers');
    if (existsSync(routersDir) && !existsSync(routersInit)) {
      await writeFile(routersInit, '', 'utf-8');
    }

    addLog(projectId, 'qa', 'running', 'Installing dependencies');

    let pipOutput = '';
    try {
      const pipResult = await execAsync(
        `cd "${workspacePath}" && pip install -r requirements.txt pytest httpx 2>&1`,
        { timeout: 120000 }
      );
      pipOutput = pipResult.stdout + '\n' + pipResult.stderr;
    } catch (installErr) {
      const output = installErr.stdout || '' + '\n' + (installErr.stderr || '') + '\n' + installErr.message;
      addLog(projectId, 'qa', 'error', 'Dependency installation failed', { output });
      return {
        passed: 0, failed: 0, errors: 0, total: 0, percentage: 0,
        output: `Dependency installation failed:\n${output}`,
        workspacePath,
      };
    }

    addLog(projectId, 'qa', 'running', 'Executing pytest');

    let testOutput = '';
    let exitCode = 0;
    try {
      const result = await execAsync(
        `cd "${workspacePath}" && python -m pytest tests/ -v --tb=short 2>&1`,
        { timeout: 120000 }
      );
      testOutput = result.stdout + '\n' + result.stderr;
    } catch (testErr) {
      exitCode = testErr.code || 1;
      testOutput = (testErr.stdout || '') + '\n' + (testErr.stderr || '');
    }

    const results = parseTestOutput(testOutput);
    results.output = testOutput;
    results.workspacePath = workspacePath;
    results.exitCode = exitCode;

    addLog(projectId, 'qa', results.percentage >= 80 ? 'success' : 'warning',
      `Tests completed: ${results.passed}/${results.total} passed (${results.percentage}%)`,
      { passed: results.passed, failed: results.failed, errors: results.errors, total: results.total }
    );

    return results;
  } catch (err) {
    addLog(projectId, 'qa', 'error', `Test execution failed: ${err.message}`);
    return {
      passed: 0, failed: 0, errors: 0, total: 0, percentage: 0,
      output: `Workspace setup failed: ${err.message}`,
      workspacePath,
    };
  }
}

export async function cleanupWorkspace(workspacePath) {
  try {
    if (workspacePath && existsSync(workspacePath)) {
      await rm(workspacePath, { recursive: true, force: true });
    }
  } catch {
    // Best effort cleanup
  }
}

function parseTestFiles(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/gm, '').replace(/```\s*$/gm, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('QA Agent failed to produce valid JSON test files');
  }
}

function parseTestOutput(output) {
  const passedMatch = output.match(/(\d+)\s+passed/);
  const failedMatch = output.match(/(\d+)\s+failed/);
  const errorMatch = output.match(/(\d+)\s+error/);

  const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
  const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
  const errors = errorMatch ? parseInt(errorMatch[1], 10) : 0;
  const total = passed + failed + errors;
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;

  return { passed, failed, errors, total, percentage };
}