const fs = require('fs');
const path = require('path');

const USERNAME = process.env.GITHUB_REPOSITORY_OWNER || 'Kromilla';
const README_PATH = path.join(__dirname, '../../README.md');
const MAX_EVENTS = 5;
const START_MARKER = '<!--START_SECTION:activity-->';
const END_MARKER = '<!--END_SECTION:activity-->';

async function fetchActivity() {
  try {
    const response = await fetch(`https://api.github.com/users/${USERNAME}/events/public`);
    if (!response.ok) throw new Error(`Failed to fetch events: ${response.statusText}`);
    return response.json();
  } catch (error) {
    console.error('Error fetching activity:', error);
    process.exit(1);
  }
}

function formatEvent(event) {
  const repoName = event.repo.name;
  const repoUrl = `https://github.com/${repoName}`;

  switch (event.type) {
    case 'PushEvent': {
      const commitCount =
        event.payload.size ||
        event.payload.distinct_size ||
        (event.payload.commits && event.payload.commits.length) ||
        1;
      const commitMsg = commitCount === 1 ? 'commit' : 'commits';
      return `💪 Pushed ${commitCount} ${commitMsg} to [${repoName}](${repoUrl})`;
    }
    case 'PullRequestEvent':
      return `🎉 ${event.payload.action.charAt(0).toUpperCase() + event.payload.action.slice(1)} PR in [${repoName}](${repoUrl})`;
    case 'IssuesEvent':
      return `🐛 ${event.payload.action.charAt(0).toUpperCase() + event.payload.action.slice(1)} issue in [${repoName}](${repoUrl})`;
    case 'IssueCommentEvent':
      return `💬 Commented on issue in [${repoName}](${repoUrl})`;
    case 'CreateEvent':
      if (event.payload.ref_type === 'repository') {
        return `🆕 Created repository [${repoName}](${repoUrl})`;
      }
      return `🔨 Created ${event.payload.ref_type} in [${repoName}](${repoUrl})`;
    case 'WatchEvent':
      return `⭐ Starred [${repoName}](${repoUrl})`;
    default:
      return null;
  }
}

function extractActivitySection(content) {
  const regex = new RegExp(`${START_MARKER}\\n([\\s\\S]*?)\\n${END_MARKER}`);
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function buildActivitySection(events) {
  const uniqueRepoEvents = [];
  const seenRepos = new Set();

  for (const event of events) {
    if (!seenRepos.has(event.repo.name)) {
      const formatted = formatEvent(event);
      if (formatted) {
        uniqueRepoEvents.push(formatted);
        seenRepos.add(event.repo.name);
      }
    }
    if (uniqueRepoEvents.length >= MAX_EVENTS) break;
  }

  if (!uniqueRepoEvents.length) return null;

  return uniqueRepoEvents.map((line) => `- ${line}`).join('\n');
}

async function updateReadme() {
  const events = await fetchActivity();
  const recentActivity = buildActivitySection(events);

  if (!recentActivity) {
    console.log('No recent activity found.');
    return;
  }

  let readmeContent = fs.readFileSync(README_PATH, 'utf8');
  const currentActivity = extractActivitySection(readmeContent);

  if (currentActivity === recentActivity) {
    console.log('Activity section unchanged. Skipping update.');
    return;
  }

  const regex = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`);
  if (!regex.test(readmeContent)) {
    console.error('Could not find activity section markers in README.md');
    process.exit(1);
  }

  const newContent = `${START_MARKER}\n${recentActivity}\n${END_MARKER}`;
  readmeContent = readmeContent.replace(regex, newContent);
  fs.writeFileSync(README_PATH, readmeContent);
  console.log('README.md updated successfully.');
}

updateReadme();
