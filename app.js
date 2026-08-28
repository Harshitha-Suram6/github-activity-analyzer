const BASE = 'https://api.github.com';
let langChart = null;
let starsChart = null;
let yearChart = null;

// Language color mapping for top languages
const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Go: '#00ADD8',
  Rust: '#dea584',
  PHP: '#4F5D95',
  Ruby: '#701516',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Vue: '#41b883',
  Shell: '#89e051'
};

/**
 * Main analyze entry point
 */
async function analyze() {
  const usernameInput = document.getElementById('usernameInput');
  const rawUsername = usernameInput.value.trim();
  const errorBanner = document.getElementById('error');

  errorBanner.textContent = '';
  errorBanner.classList.add('hidden');

  if (!rawUsername) {
    showError('Please enter a GitHub username to analyze.');
    return;
  }

  const username = encodeURIComponent(rawUsername);

  show('loader');
  hide('results');

  try {
    const [user, repos] = await Promise.all([
      fetchJSON(`${BASE}/users/${username}`),
      fetchJSON(`${BASE}/users/${username}/repos?per_page=100&sort=updated`)
    ]);

    if (!Array.isArray(repos)) {
      throw new Error('Could not retrieve user repositories.');
    }

    renderProfile(user, repos);
    renderCharts(repos);
    renderTopRepos(repos);

    hide('loader');
    show('results');
  } catch (err) {
    hide('loader');
    if (err.message === '404') {
      showError(`User "${rawUsername}" not found on GitHub.`);
    } else if (err.message === '403') {
      showError('GitHub API rate limit exceeded. Please wait a few minutes and try again.');
    } else {
      showError(err.message || 'Something went wrong while fetching data. Please try again.');
    }
  }
}

/**
 * Helper to fetch and parse JSON
 */
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(String(res.status));
  }
  return res.json();
}

/**
 * Render Profile Metadata & Stat Counters
 */
function renderProfile(user, repos) {
  document.getElementById('avatar').src = user.avatar_url;
  document.getElementById('name').textContent = user.name || user.login;
  
  const userLink = document.getElementById('userLink');
  userLink.textContent = `@${user.login}`;
  userLink.href = user.html_url;

  const profileBtn = document.getElementById('profileBtn');
  profileBtn.href = user.html_url;

  document.getElementById('bio').textContent = user.bio || 'No public bio provided.';

  // Calculate total stars across all fetched public repos
  const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);

  // CORRECT STAT MAPPING
  document.getElementById('total_stars').textContent = totalStars.toLocaleString();
  document.getElementById('public_repos').textContent = user.public_repos.toLocaleString();
  document.getElementById('followers').textContent = user.followers.toLocaleString();
  document.getElementById('following').textContent = user.following.toLocaleString();

  // Render extra meta badges
  setMetaItem('metaCompany', user.company);
  setMetaItem('metaLocation', user.location);
  
  if (user.blog) {
    const blogItem = document.getElementById('metaBlog');
    const blogLink = blogItem.querySelector('a');
    let formattedBlog = user.blog.startsWith('http') ? user.blog : `https://${user.blog}`;
    blogLink.href = formattedBlog;
    blogLink.textContent = user.blog.replace(/^https?:\/\//, '');
    blogItem.classList.remove('hidden');
  } else {
    document.getElementById('metaBlog').classList.add('hidden');
  }

  // Joined date
  if (user.created_at) {
    const date = new Date(user.created_at);
    const joinedStr = `Joined ${date.toLocaleString('default', { month: 'short', year: 'numeric' })}`;
    const joinedItem = document.getElementById('metaJoined');
    joinedItem.querySelector('.val').textContent = joinedStr;
  }
}

/**
 * Helper to toggle meta badges
 */
function setMetaItem(id, val) {
  const el = document.getElementById(id);
  if (val) {
    el.querySelector('.val').textContent = val;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

/**
 * Render Chart.js Visualizations
 */
function renderCharts(repos) {
  // --- 1. Languages Chart ---
  const langCount = {};
  repos.forEach(r => {
    if (r.language) {
      langCount[r.language] = (langCount[r.language] || 0) + 1;
    }
  });

  const topLangs = Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  destroyExistingChart('langChart');
  const langCanvas = document.getElementById('langChart');

  if (topLangs.length > 0) {
    const colors = topLangs.map(([lang]) => LANGUAGE_COLORS[lang] || '#58a6ff');
    langChart = new Chart(langCanvas, {
      type: 'doughnut',
      data: {
        labels: topLangs.map(l => l[0]),
        datasets: [{
          data: topLangs.map(l => l[1]),
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#161b22'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#8b949e', font: { family: 'Inter', size: 12 }, padding: 16 }
          }
        }
      }
    });
  }

  // --- 2. Top Repos by Stars Chart ---
  const topStarredRepos = [...repos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 6);

  destroyExistingChart('starsChart');
  const starsCanvas = document.getElementById('starsChart');

  if (topStarredRepos.length > 0) {
    starsChart = new Chart(starsCanvas, {
      type: 'bar',
      data: {
        labels: topStarredRepos.map(r => r.name.length > 14 ? r.name.substring(0, 12) + '…' : r.name),
        datasets: [{
          label: 'Stars',
          data: topStarredRepos.map(r => r.stargazers_count),
          backgroundColor: 'rgba(57, 211, 83, 0.75)',
          hoverBackgroundColor: '#39d353',
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: '#8b949e', font: { family: 'Inter', size: 11 } },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#8b949e', font: { family: 'Inter', size: 11 }, precision: 0 },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  }

  // --- 3. Repos Created Per Year Chart ---
  const yearCount = {};
  repos.forEach(r => {
    if (r.created_at) {
      const year = new Date(r.created_at).getFullYear();
      yearCount[year] = (yearCount[year] || 0) + 1;
    }
  });

  const years = Object.keys(yearCount).sort();

  destroyExistingChart('yearChart');
  const yearCanvas = document.getElementById('yearChart');

  if (years.length > 0) {
    yearChart = new Chart(yearCanvas, {
      type: 'line',
      data: {
        labels: years,
        datasets: [{
          label: 'Repos Created',
          data: years.map(y => yearCount[y]),
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88, 166, 255, 0.12)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#58a6ff',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: '#8b949e', font: { family: 'Inter', size: 11 } },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#8b949e', font: { family: 'Inter', size: 11 }, precision: 0 },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  }
}

/**
 * Safely destroy existing Chart instance by canvas ID
 */
function destroyExistingChart(canvasId) {
  const canvasElement = document.getElementById(canvasId);
  if (!canvasElement) return;

  const existingChart = Chart.getChart(canvasElement);
  if (existingChart) {
    existingChart.destroy();
  }
}

/**
 * Render Top 6 Repositories Showcase Grid
 */
function renderTopRepos(repos) {
  const grid = document.getElementById('reposGrid');
  grid.innerHTML = '';

  const sortedRepos = [...repos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 6);

  if (sortedRepos.length === 0) {
    grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">No public repositories found.</p>';
    return;
  }

  sortedRepos.forEach(repo => {
    const card = document.createElement('div');
    card.className = 'repo-card';

    const langColor = LANGUAGE_COLORS[repo.language] || '#8b949e';

    card.innerHTML = `
      <div>
        <div class="repo-name">
          <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            ${repo.name}
          </a>
        </div>
        <p class="repo-desc">${repo.description || 'No description provided.'}</p>
      </div>

      <div class="repo-meta">
        ${repo.language ? `
          <span class="lang-badge">
            <span class="lang-color" style="background-color: ${langColor};"></span>
            ${repo.language}
          </span>
        ` : ''}
        <span class="repo-stat">
          ⭐ ${repo.stargazers_count.toLocaleString()}
        </span>
        <span class="repo-stat">
          🍴 ${repo.forks_count.toLocaleString()}
        </span>
      </div>
    `;

    grid.appendChild(card);
  });
}

/**
 * Quick search suggestion trigger
 */
function quickSearch(username) {
  document.getElementById('usernameInput').value = username;
  analyze();
}

/**
 * Error display helper
 */
function showError(msg) {
  const errorBanner = document.getElementById('error');
  errorBanner.textContent = msg;
  errorBanner.classList.remove('hidden');
}

/**
 * UI Visibility Helpers
 */
function show(id) {
  document.getElementById(id).classList.remove('hidden');
}

function hide(id) {
  document.getElementById(id).classList.add('hidden');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('usernameInput');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        analyze();
      }
    });
  }
});
