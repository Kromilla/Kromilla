const fs = require('fs');
const path = require('path');

const USERNAME = process.env.GITHUB_REPOSITORY_OWNER || 'Kromilla';
const README_PATH = path.join(__dirname, '../../README.md');
const EXCLUDE_REPOS = new Set(
  (process.env.EXCLUDE_REPOS || `${USERNAME}/${USERNAME}`)
    .split(',')
    .map((repo) => repo.trim())
    .filter(Boolean)
);
const PRIORITY_REPOS = (process.env.PRIORITY_REPOS || [
  'Discord-web-controller',
  'UniReportes',
  'Flowers',
  'universal-downloader',
  'Laboratorio-MLFLOW',
].join(','))
  .split(',')
  .map((repo) => repo.trim())
  .filter(Boolean);
const MAX_REPOS = Number(process.env.MAX_REPOS || 6);
const START_MARKER = '<!--START_SECTION:top-repos-->';
const END_MARKER = '<!--END_SECTION:top-repos-->';

async function fetchTopRepos() {
  const repos = [];
  let page = 1;

  while (repos.length < MAX_REPOS + EXCLUDE_REPOS.size && page <= 3) {
    const response = await fetch(
      `https://api.github.com/users/${USERNAME}/repos?per_page=100&page=${page}&sort=updated`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch repositories: ${response.statusText}`);
    }

    repos.push(...(await response.json()));
    page += 1;
  }

  return repos
    .filter((repo) => !repo.fork && !repo.private && !EXCLUDE_REPOS.has(repo.full_name))
    .sort((a, b) => {
      const aPriority = PRIORITY_REPOS.indexOf(a.name);
      const bPriority = PRIORITY_REPOS.indexOf(b.name);
      const aRank = aPriority === -1 ? Number.MAX_SAFE_INTEGER : aPriority;
      const bRank = bPriority === -1 ? Number.MAX_SAFE_INTEGER : bPriority;

      if (aRank !== bRank) {
        return aRank - bRank;
      }

      if (b.stargazers_count !== a.stargazers_count) {
        return b.stargazers_count - a.stargazers_count;
      }

      const aHasDescription = Boolean(a.description);
      const bHasDescription = Boolean(b.description);
      if (aHasDescription !== bHasDescription) {
        return Number(bHasDescription) - Number(aHasDescription);
      }

      return new Date(b.pushed_at) - new Date(a.pushed_at);
    })
    .slice(0, MAX_REPOS);
}

function formatLanguage(language) {
  if (!language) return 'Other';
  return language;
}

const FALLBACK_DESCRIPTIONS = {
  'Discord-web-controller': 'Real-time bot management dashboard built with Next.js 14.',
  UniReportes: 'Automated reporting engine for academic institutions.',
  Flowers: 'Organic interaction engine with GPU-accelerated compositing.',
  'universal-downloader': 'Cross-platform media downloader CLI and API.',
  'Laboratorio-MLFLOW': 'Reproducible ML pipelines with MLflow experiment tracking.',
};

function getDescription(repo) {
  return repo.description || FALLBACK_DESCRIPTIONS[repo.name] || 'No description provided.';
}

function buildTopReposSection(repos) {
  if (!repos.length) return null;

  const rows = repos.map((repo) => {
    const language = formatLanguage(repo.language);
    const description = getDescription(repo).replace(/\|/g, '\\|');
    const stars = repo.stargazers_count.toLocaleString('en-US');
    const forks = repo.forks_count.toLocaleString('en-US');

    return `| [${repo.name}](${repo.html_url}) | ${description} | \`${language}\` | ⭐ ${stars} · 🍴 ${forks} |`;
  });

  return [
    '| Repository | Description | Stack | Metrics |',
    '| :--- | :--- | :---: | :---: |',
    ...rows,
  ].join('\n');
}

function extractSection(content) {
  const regex = new RegExp(`${START_MARKER}\\n([\\s\\S]*?)\\n${END_MARKER}`);
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

async function updateReadme() {
  const repos = await fetchTopRepos();
  const topReposSection = buildTopReposSection(repos);

  if (!topReposSection) {
    console.log('No repositories found to display.');
    return;
  }

  let readmeContent = fs.readFileSync(README_PATH, 'utf8');
  const currentSection = extractSection(readmeContent);

  if (currentSection === topReposSection) {
    console.log('Top repositories section unchanged. Skipping update.');
    return;
  }

  const regex = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`);
  if (!regex.test(readmeContent)) {
    console.error('Could not find top repositories section markers in README.md');
    process.exit(1);
  }

  readmeContent = readmeContent.replace(regex, `${START_MARKER}\n${topReposSection}\n${END_MARKER}`);
  fs.writeFileSync(README_PATH, readmeContent);
  console.log(`Updated top repositories section with ${repos.length} repositories.`);
}

updateReadme().catch((error) => {
  console.error('Error updating top repositories:', error);
  process.exit(1);
});
