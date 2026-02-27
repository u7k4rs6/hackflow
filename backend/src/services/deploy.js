import { getSetting } from './database.js';

export async function triggerDeploy(appName, githubUrl, generatedFiles) {
  const railwayToken = process.env.RAILWAY_TOKEN || getSetting('railway_token');

  if (railwayToken) {
    return await deployToRailway(appName, githubUrl, railwayToken);
  }

  const renderKey = process.env.RENDER_API_KEY || getSetting('render_api_key');
  if (renderKey) {
    return await deployToRender(appName, githubUrl, renderKey);
  }

  return `manual://${appName} — No deployment platform configured. Deploy using the Dockerfile.`;
}

async function deployToRailway(appName, githubUrl, token) {
  const sanitizedName = appName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .substring(0, 50);

  const createProjectQuery = `
    mutation {
      projectCreate(input: {
        name: "${sanitizedName}"
      }) {
        id
        name
      }
    }
  `;

  const response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query: createProjectQuery }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Railway API error: ${response.status} - ${text}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`Railway GraphQL error: ${JSON.stringify(data.errors)}`);
  }

  const projectId = data.data?.projectCreate?.id;
  if (!projectId) {
    throw new Error('Railway project creation returned no ID');
  }

  const repoPath = githubUrl.replace('https://github.com/', '');
  const serviceQuery = `
    mutation {
      serviceCreate(input: {
        projectId: "${projectId}"
        name: "${sanitizedName}-service"
        source: {
          repo: "${repoPath}"
        }
      }) {
        id
        name
      }
    }
  `;

  await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query: serviceQuery }),
  });

  return `https://railway.app/project/${projectId}`;
}

async function deployToRender(appName, githubUrl, apiKey) {
  const sanitizedName = appName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .substring(0, 50);

  const response = await fetch('https://api.render.com/v1/services', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      type: 'web_service',
      name: sanitizedName,
      repo: githubUrl,
      autoDeploy: 'yes',
      branch: 'main',
      buildCommand: 'pip install -r requirements.txt',
      startCommand: 'uvicorn main:app --host 0.0.0.0 --port $PORT',
      envVars: [],
      plan: 'free',
      runtime: 'python',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Render API error: ${response.status} - ${text}`);
  }

  return `https://${sanitizedName}.onrender.com`;
}