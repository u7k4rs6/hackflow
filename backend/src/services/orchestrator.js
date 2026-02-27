import { v4 as uuid } from 'uuid';
import { getDb, getSetting, createProject, getProject, updateProject, addLog } from './database.js';
import { runPlanner } from '../agents/planner.js';
import { runBuilder, runBuilderRetry } from '../agents/builder.js';
import { runQA, executeTests, cleanupWorkspace } from '../agents/qa.js';
import { createGitHubRepo } from './github.js';
import { triggerDeploy } from './deploy.js';

const activeRuns = new Map();

export function getActiveRun(projectId) {
  return activeRuns.get(projectId) || null;
}

export function getAllActiveRuns() {
  const runs = {};
  for (const [id, data] of activeRuns.entries()) {
    runs[id] = data;
  }
  return runs;
}

export async function startPipeline(idea) {
  const projectId = uuid();
  const name = idea
    .substring(0, 80)
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim();

  createProject(projectId, name, idea);
  activeRuns.set(projectId, { step: 'queued', progress: 0, startedAt: Date.now() });

  runPipelineAsync(projectId, idea).catch(err => {
    console.error(`Pipeline ${projectId} fatal error:`, err);
    updateProject(projectId, { status: 'failed', error: err.message, current_step: 'fatal_error' });
    addLog(projectId, 'orchestrator', 'error', `Fatal pipeline error: ${err.message}`);
    activeRuns.delete(projectId);
  });

  return { projectId, status: 'started' };
}

async function runPipelineAsync(projectId, idea) {
  const threshold = parseInt(getSetting('test_threshold') || '80', 10);
  const maxRetries = parseInt(getSetting('max_retries') || '1', 10);

  try {
    // ═══════════════════════════════════
    // STEP 1: PLANNER
    // ═══════════════════════════════════
    setStep(projectId, 'planning', 10);
    updateProject(projectId, { status: 'running', current_step: 'planning' });
    addLog(projectId, 'planning', 'started', 'Planner Agent analyzing idea...');

    const plannerResult = await runPlanner(projectId, idea);

    if (!plannerResult.success) {
      return fail(projectId, 'planning', plannerResult.error);
    }

    const spec = plannerResult.spec;
    updateProject(projectId, { spec, current_step: 'planning_done' });
    setStep(projectId, 'planning_done', 25);
    addLog(projectId, 'planning', 'completed',
      `Spec: ${spec.display_name} — ${spec.models.length} models, ${spec.endpoints.length} endpoints`,
      JSON.stringify(spec)
    );

    // ═══════════════════════════════════
    // STEP 2: BUILDER
    // ═══════════════════════════════════
    setStep(projectId, 'building', 30);
    updateProject(projectId, { current_step: 'building' });
    addLog(projectId, 'building', 'started', 'Builder Agent generating application code...');

    const builderResult = await runBuilder(projectId, spec);

    if (!builderResult.success) {
      return fail(projectId, 'building', builderResult.error);
    }

    let generatedFiles = builderResult.files;
    const fileCount = Object.keys(generatedFiles).length;
    updateProject(projectId, { generated_files: generatedFiles, current_step: 'building_done' });
    setStep(projectId, 'building_done', 50);
    addLog(projectId, 'building', 'completed',
      `Generated ${fileCount} files`,
      JSON.stringify(Object.keys(generatedFiles))
    );

    // ═══════════════════════════════════
    // STEP 3: QA — GENERATE TESTS
    // ═══════════════════════════════════
    setStep(projectId, 'testing', 55);
    updateProject(projectId, { current_step: 'testing' });
    addLog(projectId, 'testing', 'started', 'QA Agent generating tests...');

    const qaResult = await runQA(projectId, spec, generatedFiles);

    if (!qaResult.success) {
      return fail(projectId, 'testing', qaResult.error);
    }

    const testFiles = qaResult.testFiles;
    updateProject(projectId, { test_files: testFiles });
    addLog(projectId, 'testing', 'running',
      `Generated ${Object.keys(testFiles).length} test file(s), executing...`
    );

    // ═══════════════════════════════════
    // STEP 4: QA — EXECUTE TESTS
    // ═══════════════════════════════════
    setStep(projectId, 'executing_tests', 60);
    updateProject(projectId, { current_step: 'executing_tests' });

    let testResults = await executeTests(projectId, generatedFiles, testFiles);
    updateProject(projectId, { test_results: testResults });
    setStep(projectId, 'tests_done', 70);

    addLog(projectId, 'testing', 'executed',
      `Results: ${testResults.passed}/${testResults.total} passed (${testResults.percentage}%)`,
      JSON.stringify({
        passed: testResults.passed,
        failed: testResults.failed,
        errors: testResults.errors,
        total: testResults.total,
        percentage: testResults.percentage,
      })
    );

    // ═══════════════════════════════════
    // STEP 5: RETRY IF BELOW THRESHOLD
    // ═══════════════════════════════════
    if (testResults.percentage < threshold && maxRetries > 0) {
      addLog(projectId, 'retrying', 'started',
        `Tests at ${testResults.percentage}% (threshold: ${threshold}%). Retrying build...`
      );
      setStep(projectId, 'retrying', 72);
      updateProject(projectId, { current_step: 'retrying', retry_count: 1 });

      try {
        const retryResult = await runBuilderRetry(projectId, spec, generatedFiles, testResults.output);

        if (retryResult.success) {
          generatedFiles = retryResult.files;
          updateProject(projectId, { generated_files: generatedFiles });
          addLog(projectId, 'retrying', 'rebuilt', 'Builder regenerated code with fixes');

          if (testResults.workspacePath) {
            await cleanupWorkspace(testResults.workspacePath);
          }

          setStep(projectId, 'retesting', 78);
          testResults = await executeTests(projectId, generatedFiles, testFiles);
          updateProject(projectId, { test_results: testResults });

          addLog(projectId, 'retrying', 'retested',
            `Retry: ${testResults.passed}/${testResults.total} passed (${testResults.percentage}%)`,
            JSON.stringify({
              passed: testResults.passed,
              failed: testResults.failed,
              total: testResults.total,
              percentage: testResults.percentage,
            })
          );
        } else {
          addLog(projectId, 'retrying', 'failed', 'Builder retry failed, proceeding with original code');
        }
      } catch (retryErr) {
        addLog(projectId, 'retrying', 'failed', `Retry error: ${retryErr.message}`);
      }

      if (testResults.percentage < threshold) {
        const msg = `Tests still below threshold after retry: ${testResults.percentage}% < ${threshold}%`;
        addLog(projectId, 'retrying', 'failed', msg);
        // Don't hard-fail — proceed to push what we have
      }
    }

    if (testResults.workspacePath) {
      await cleanupWorkspace(testResults.workspacePath);
    }

    addLog(projectId, 'testing', 'completed',
      `Final test rate: ${testResults.percentage}%`
    );
    setStep(projectId, 'tests_complete', 80);

    // ═══════════════════════════════════
    // STEP 6: GITHUB PUSH
    // ═══════════════════════════════════
    let githubUrl = null;
    const githubToken = process.env.GITHUB_TOKEN || getSetting('github_token');

    if (githubToken) {
      setStep(projectId, 'github', 85);
      updateProject(projectId, { current_step: 'github' });
      addLog(projectId, 'github', 'started', 'Creating GitHub repository...');

      try {
        const repoName = `autoship-${spec.app_name}`;
        const allFiles = { ...generatedFiles, ...testFiles };
        githubUrl = await createGitHubRepo(repoName, spec.description || spec.display_name, allFiles);
        updateProject(projectId, { github_url: githubUrl });
        addLog(projectId, 'github', 'completed', `Repository created: ${githubUrl}`);
      } catch (ghErr) {
        addLog(projectId, 'github', 'failed', `GitHub push failed (non-blocking): ${ghErr.message}`);
      }
    } else {
      addLog(projectId, 'github', 'skipped', 'No GitHub token configured');
    }

    setStep(projectId, 'github_done', 88);

    // ═══════════════════════════════════
    // STEP 7: DEPLOY
    // ═══════════════════════════════════
    let deployUrl = null;
    const deployToken = process.env.RAILWAY_TOKEN || getSetting('railway_token')
      || process.env.RENDER_API_KEY || getSetting('render_api_key');

    if (deployToken && githubUrl) {
      setStep(projectId, 'deploying', 90);
      updateProject(projectId, { current_step: 'deploying' });
      addLog(projectId, 'deploy', 'started', 'Triggering deployment...');

      try {
        deployUrl = await triggerDeploy(spec.app_name, githubUrl, generatedFiles);
        updateProject(projectId, { deploy_url: deployUrl });
        addLog(projectId, 'deploy', 'completed', `Deployed to: ${deployUrl}`);
      } catch (deployErr) {
        addLog(projectId, 'deploy', 'failed', `Deployment failed (non-blocking): ${deployErr.message}`);
      }
    } else {
      addLog(projectId, 'deploy', 'skipped',
        !deployToken ? 'No deployment token configured' : 'No GitHub URL for deployment'
      );
    }

    // ═══════════════════════════════════
    // DONE
    // ═══════════════════════════════════
    const finalStatus = testResults.percentage >= threshold ? 'completed' : 'completed_with_warnings';
    updateProject(projectId, {
      status: finalStatus,
      current_step: 'done',
      github_url: githubUrl,
      deploy_url: deployUrl,
    });
    setStep(projectId, 'done', 100);

    addLog(projectId, 'completed', 'success', 'Pipeline completed', JSON.stringify({
      test_pass_rate: testResults.percentage,
      github_url: githubUrl,
      deploy_url: deployUrl,
    }));

    setTimeout(() => activeRuns.delete(projectId), 120000);

  } catch (err) {
    fail(projectId, 'orchestrator', err.message);
    throw err;
  }
}

function setStep(projectId, step, progress) {
  activeRuns.set(projectId, {
    ...(activeRuns.get(projectId) || {}),
    step,
    progress,
    updatedAt: Date.now(),
  });
}

function fail(projectId, step, errorMessage) {
  updateProject(projectId, { status: 'failed', error: errorMessage, current_step: step });
  addLog(projectId, step, 'error', `Pipeline failed: ${errorMessage}`);
  activeRuns.set(projectId, {
    step: 'failed',
    progress: 0,
    error: errorMessage,
    updatedAt: Date.now(),
  });
  setTimeout(() => activeRuns.delete(projectId), 120000);
}