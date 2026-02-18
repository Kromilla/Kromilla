const fs = require('fs');
const path = require('path');

const USERNAME = 'Kromilla';
const README_PATH = path.join(__dirname, '../../README.md');
const MAX_EVENTS = 5;

async function fetchActivity() {
  try {
    const response = await fetch(`https://api.github.com/users/${USERNAME}/events/public`);
    if (!response.ok) throw new Error(`Failed to fetch events: ${response.statusText}`);
    const events = await response.json();
    return events;
  } catch (error) {
    console.error('Error fetching activity:', error);
    process.exit(1);
  }
}

function formatEvent(event) {
  const repoName = event.repo.name;
  const repoUrl = `https://github.com/${repoName}`;
  const actor = event.actor.display_login || event.actor.login;

  switch (event.type) {
    case 'PushEvent':
      const commitCount = event.payload.size || event.payload.distinct_size || (event.payload.commits && event.payload.commits.length) || 1;
      const commitMsg = commitCount === 1 ? 'commit' : 'commits';
      return `💪 Pushed ${commitCount} ${commitMsg} to [${repoName}](${repoUrl})`;
    case 'PullRequestEvent':
      const action = event.payload.action;
      return `🎉 ${action.charAt(0).toUpperCase() + action.slice(1)} PR in [${repoName}](${repoUrl})`;
    case 'IssuesEvent':
      const issueAction = event.payload.action;
      return `🐛 ${issueAction.charAt(0).toUpperCase() + issueAction.slice(1)} issue in [${repoName}](${repoUrl})`;
    case 'IssueCommentEvent':
      return `💬 Commented on issue in [${repoName}](${repoUrl})`;
    case 'CreateEvent': // Usually for creating repos or branches
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

async function updateReadme() {
  const events = await fetchActivity();
  
  // Filter for unique repositories
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

  const recentActivity = uniqueRepoEvents
    .map(line => `- ${line} <!-- ${new Date().toISOString()} -->`)
    .join('\n');

  if (!recentActivity) {
    console.log('No recent activity found.');
    return;
  }

  let readmeContent = fs.readFileSync(README_PATH, 'utf8');
  const startMarker = '<!--START_SECTION:activity-->';
  const endMarker = '<!--END_SECTION:activity-->';
  const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);

  if (!regex.test(readmeContent)) {
    console.error('Could not find activity section markers in README.md');
    process.exit(1);
  }

  const newContent = `${startMarker}\n${recentActivity}\n${endMarker}`;
  readmeContent = readmeContent.replace(regex, newContent);

  fs.writeFileSync(README_PATH, readmeContent);
  console.log('README.md updated successfully.');
}

updateReadme();
