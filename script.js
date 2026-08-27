/* =========================================================================
   0. SUPABASE CLOUD SYNC & AUTHENTICATION CONFIGURATION
   ========================================================================= */
const SUPABASE_URL = 'https://supabase.com/dashboard/project/gxlpmwepweujpbumyqvb';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4bHBtd2Vwd2V1anBidW15cXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NDQ0MTQsImV4cCI6MjEwMzQyMDQxNH0.adwwoQTQ4B1iSUJeTpP1D3FPee0yRdCx_vlwqDGwim0';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

// Handle user login / session check
async function checkAuthAndLoadData() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        showAppInterface();
        await loadCloudData();
    } else {
        // If not logged in, prompt user to log in or sign up inline
        showLoginScreen();
    }

    // Listen for auth state changes (e.g., logging in or out)
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUser = session.user;
            showAppInterface();
            await loadCloudData();
        } else {
            currentUser = null;
            showLoginScreen();
        }
    });
}

function showLoginScreen() {
    // Creates a lightweight login overlay if no user is authenticated
    let overlay = document.getElementById('auth-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'auth-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(24,28,34,0.95);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#e3e8ef;font-family:Arial,sans-serif;';
        overlay.innerHTML = `
            <div style="background:#313843;padding:2rem;border-radius:8px;box-shadow:0 0 10px rgba(0,0,0,0.5);width:300px;text-align:center;">
                <h2>Control Center Login</h2>
                <p style="font-size:0.85rem;color:#9aa5b1;">Log in to sync your tasks and notes across phone & PC.</p>
                <input type="email" id="auth-email" placeholder="Email" style="width:100%;padding:8px;margin-bottom:10px;background:#272e38;border:1px solid #3f4a5a;color:#fff;border-radius:4px;box-sizing:border-box;">
                <input type="password" id="auth-password" placeholder="Password" style="width:100%;padding:8px;margin-bottom:15px;background:#272e38;border:1px solid #3f4a5a;color:#fff;border-radius:4px;box-sizing:border-box;">
                <button id="login-btn" style="width:100%;padding:8px;background:#61afef;border:none;color:#181c22;font-weight:bold;border-radius:4px;cursor:pointer;margin-bottom:8px;">Log In</button>
                <button id="signup-btn" style="width:100%;padding:8px;background:none;border:1px solid #61afef;color:#61afef;border-radius:4px;cursor:pointer;">Sign Up</button>
                <p id="auth-msg" style="font-size:0.8rem;margin-top:10px;color:#e06c75;"></p>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('login-btn').addEventListener('click', async () => {
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) document.getElementById('auth-msg').textContent = error.message;
        });

        document.getElementById('signup-btn').addEventListener('click', async () => {
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) {
                document.getElementById('auth-msg').textContent = error.message;
            } else {
                alert('Sign up successful! Check your email or log in if confirmation is disabled.');
            }
        });
    }
    overlay.style.display = 'flex';
}

function showAppInterface() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.style.display = 'none';
}

/* =========================================================================
   1. KANBAN TASK BOARD LOGIC (Cloud-Synced Storage)
   ========================================================================= */
const isAddonPage = window.location.pathname.includes('addon.html');
const kanbanStorageKey = isAddonPage ? 'kanban_tasks_addon' : 'kanban_tasks';
const scratchpadStorageKey = isAddonPage ? 'myScratchpad_addon' : 'myScratchpad';

let tasks = JSON.parse(localStorage.getItem(kanbanStorageKey)) || [
    { id: '1', title: isAddonPage ? 'Check Elytra model textures' : 'Review JavaScript logic on Scrimba', status: 'todo', energy: 'medium', time: '20m' },
    { id: '2', title: isAddonPage ? 'Test Bedrock addon in-game' : 'Refactor Control Center Grid layout', status: 'inprogress', energy: 'high', time: '30m' }
];

let focusModeActive = false;
let currentEnergyFilter = 'all';

async function saveTasksAndCloud() {
    // Save to localStorage as instant offline backup
    localStorage.setItem(kanbanStorageKey, JSON.stringify(tasks));
    
    // Sync to Supabase cloud database if user is logged in
    if (currentUser) {
        const scratchpadEl = document.getElementById('scratchpad');
        const scratchpadContent = scratchpadEl ? scratchpadEl.innerHTML : '';

        await supabase.from('user_data').upsert({
            user_id: currentUser.id,
            tasks: tasks,
            scratchpad: scratchpadContent,
            updated_at: new Date()
        });
    }
}

async function loadCloudData() {
    if (!currentUser) return;

    const { data, error } = await supabase
        .from('user_data')
        .select('tasks, scratchpad')
        .eq('user_id', currentUser.id)
        .single();

    if (data) {
        if (data.tasks) {
            tasks = data.tasks;
            localStorage.setItem(kanbanStorageKey, JSON.stringify(tasks));
            renderTasks();
        }
        if (data.scratchpad) {
            const pad = document.getElementById('scratchpad');
            if (pad) {
                pad.innerHTML = data.scratchpad;
                localStorage.setItem(scratchpadStorageKey, data.scratchpad);
            }
        }
    }
}

function renderTasks() {
    const todoList = document.getElementById('todo-list');
    const inprogressList = document.getElementById('inprogress-list');
    const doneList = document.getElementById('done-list');

    if (!todoList || !inprogressList || !doneList) return;

    todoList.innerHTML = '';
    inprogressList.innerHTML = '';
    doneList.innerHTML = '';

    const visibleTasks = tasks.filter(task => {
        if (currentEnergyFilter === 'all') return true;
        return task.energy === currentEnergyFilter;
    });

    visibleTasks.forEach(task => {
        const card = document.createElement('div');
        card.className = `task-card energy-${task.energy}`;
        card.draggable = true;
        card.dataset.id = task.id;

        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', task.id);
        });

        let moveButtonsHtml = '';
        if (task.status === 'todo') {
            moveButtonsHtml = `<button class="task-move-btn" onclick="moveTask('${task.id}', 'inprogress')" title="Move to In Progress">➔</button>`;
        } else if (task.status === 'inprogress') {
            moveButtonsHtml = `
                <button class="task-move-btn" onclick="moveTask('${task.id}', 'todo')" title="Back to To Do">⬅</button>
                <button class="task-move-btn" onclick="moveTask('${task.id}', 'done')" title="Move to Done">➔</button>
            `;
        } else if (task.status === 'done') {
            moveButtonsHtml = `<button class="task-move-btn" onclick="moveTask('${task.id}', 'inprogress')" title="Back to In Progress">⬅</button>`;
        }

        const isDone = task.status === 'done';

        card.innerHTML = `
            <div class="task-card-header">
                <div class="task-title-area">
                    <input type="checkbox" class="task-checkbox" ${isDone ? 'checked' : ''} onchange="toggleTaskComplete('${task.id}')">
                    <p class="task-title" style="${isDone ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${escapeHtml(task.title)}</p>
                </div>
            </div>
            <div class="task-meta">
                <span class="task-tag">${task.energy.toUpperCase()}</span>
                ${task.time ? `<span class="task-tag">⏱️ ${escapeHtml(task.time)}</span>` : '<span></span>'}
                <div class="task-actions">
                    ${moveButtonsHtml}
                    <button class="task-delete-btn" onclick="deleteTask('${task.id}')" title="Delete Task">🗑️</button>
                </div>
            </div>
        `;

        if (task.status === 'todo') todoList.appendChild(card);
        else if (task.status === 'inprogress') inprogressList.appendChild(card);
        else if (task.status === 'done') doneList.appendChild(card);
    });
}

function allowDrop(e) { e.preventDefault(); }

function drop(e) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    const columnEl = e.target.closest('.kanban-column');
    if (columnEl && taskId) {
        moveTask(taskId, columnEl.dataset.column);
    }
}

function moveTask(id, newStatus) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.status = newStatus;
        saveTasksAndCloud();
        renderTasks();
    }
}

function toggleTaskComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.status = task.status === 'done' ? 'todo' : 'done';
        saveTasksAndCloud();
        renderTasks();
    }
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasksAndCloud();
    renderTasks();
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/* =========================================================================
   2. YOUTUBE FEED LOGIC (Sorted Newest First)
   ========================================================================= */
const creators = [
    { name: "MrBeast", channelId: "UCX6OQ3DkcsbYNE6H8uQQuVA" },
    { name: "Beast Gaming", channelId: "UCIPPMRA040LQr5QPyJEbmXA" },
    { name: "Beast Philanthropy", channelId: "UCAiLfjNXkNv24uhpzUgPa6A" },
    { name: "Ryan Trahan", channelId: "UCnmGIkw-KdI0W5siakKPKog" },
    { name: "StarTalk", channelId: "UCqoAEDirJPjEUFcF2FklnBA" },
    { name: "Mumbo Jumbo", channelId: "UChFur_NwVSbUozOcF_F2kMg" },
    { name: "Coridor Crew", channelId: "UCSpFnDQr88xCZ80N-X7t0nQ" },
    { name: "Dylan Page", channelId: "UCzPpbeK8ANcNKg5aoMB0miw" }
];

async function loadLatestVideos() {
    const container = document.getElementById('youtube-feed-container');
    if (!container) return;

    container.innerHTML = 'Loading YouTube feed...';
    let allVideos = [];

    for (const creator of creators) {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.youtube.com%2Ffeeds%2Fvideos.xml%3Fchannel_id%3D${creator.channelId}`;
        try {
            const response = await fetch(apiUrl);
            const data = await response.json();
            
            if (data.status === 'ok' && data.items && data.items.length > 0) {
                const video = data.items.find(item => !item.link.includes('/shorts/'));
                if (video) {
                    const videoId = video.guid.split(':')[2];
                    const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                    
                    const videoDate = new Date(video.pubDate);
                    const today = new Date();
                    const diffTime = today - videoDate;
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    
                    let dateString = "";
                    if (diffDays === 0) dateString = "Today";
                    else if (diffDays === 1) dateString = "Yesterday";
                    else if (diffDays <= 29) dateString = `${diffDays} days ago`;
                    else if (diffDays < 365) {
                        const diffMonths = Math.floor(diffDays / 30);
                        dateString = diffMonths === 1 ? "1 month ago" : `${diffMonths} months ago`;
                    } else {
                        const diffYears = Math.floor(diffDays / 365);
                        dateString = diffYears === 1 ? "1 year ago" : `${diffYears} years ago`;
                    }

                    allVideos.push({
                        title: video.title,
                        link: video.link,
                        thumbUrl: thumbUrl,
                        pubDate: videoDate,
                        dateString: dateString,
                        creatorName: creator.name
                    });
                }
            }
        } catch (error) { 
            console.error("Failed to load:", creator.name, error); 
        }

        await new Promise(resolve => setTimeout(resolve, 300));
    }

    allVideos.sort((a, b) => b.pubDate - a.pubDate);
    container.innerHTML = '';
    
    if (allVideos.length === 0) {
        container.innerHTML = '<p>No videos found or rate limit reached. Please try again later.</p>';
        return;
    }

    allVideos.forEach(video => {
        container.innerHTML += `
            <a href="${video.link}" target="_blank" class="video-button">
                <img src="${video.thumbUrl}" alt="${video.title}">
                <span class="video-title">${video.title}</span>
                <small class="video-date">${video.dateString}</small>
                <span class="creator-name">${video.creatorName}</span>
            </a>
        `;
    });
}

/* =========================================================================
   3. SCRATCHPAD LOGIC (Cloud-Synced)
   ========================================================================= */
function setupScratchpad(id, storageKey) {
    const pad = document.getElementById(id);
    if (!pad) return;
    
    pad.innerHTML = localStorage.getItem(storageKey) || '';
    
    let saveTimeout;
    pad.addEventListener('input', () => {
        localStorage.setItem(storageKey, pad.innerHTML);
        
        // Debounce cloud saving so it doesn't spam requests on every single keystroke
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            saveTasksAndCloud();
        }, 1000);
    });

    pad.addEventListener('click', (e) => {
        const anchor = e.target.closest('a');
        if (anchor && anchor.href) { e.preventDefault(); window.open(anchor.href, '_blank'); }
    });
}

function addLink(id) {
    const pad = document.getElementById(id);
    const url = prompt("Enter URL:");
    if (!url) return;
    const cleanUrl = url.startsWith('http') ? url : 'https://' + url;
    document.execCommand('insertHTML', false, `<a href="${cleanUrl}" target="_blank">${cleanUrl}</a>`);
    saveTasksAndCloud();
}

function triggerImageUpload(id) { document.getElementById('file-' + id).click(); }

function handleFileSelect(event, id) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.execCommand('insertImage', false, e.target.result);
            saveTasksAndCloud();
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}

/* =========================================================================
   4. SPACE NEWS
   ========================================================================= */
async function loadSpaceNews() {
    const container = document.getElementById('space-news-container');
    if (!container) return;
    
    container.innerHTML = 'Loading space news...';

    try {
        const response = await fetch('https://api.spaceflightnewsapi.net/v4/articles/?limit=6');
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            container.innerHTML = ''; 
            data.results.forEach(article => {
                const pubDate = new Date(article.published_at);
                const month = String(pubDate.getMonth() + 1).padStart(2, '0');
                const day = String(pubDate.getDate()).padStart(2, '0');
                const year = pubDate.getFullYear();
                const dateString = `${month}/${day}/${year}`;

                container.innerHTML += `
                    <a href="${article.url}" target="_blank" class="space-news-card">
                        <img src="${article.image_url}" alt="${article.title}">
                        <div class="space-news-content">
                            <span class="space-news-title">${article.title}</span>
                            <small class="space-news-date">${dateString} • ${article.news_site}</small>
                        </div>
                    </a>
                `;
            });
        } else {
            container.innerHTML = '<p>No space news available right now.</p>';
        }
    } catch (error) {
        console.error("Failed to load space news:", error);
        container.innerHTML = '<p style="color: red;">Failed to load space news.</p>';
    }
}

/* =========================================================================
   5. INIT & EVENT LISTENERS
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Cloud Authentication and Data Sync
    checkAuthAndLoadData();

    const form = document.getElementById('task-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const newTask = {
                id: Date.now().toString(),
                title: document.getElementById('task-title').value.trim(),
                status: 'todo',
                energy: document.getElementById('task-energy').value,
                time: document.getElementById('task-time').value.trim()
            };
            if (newTask.title) {
                tasks.push(newTask);
                saveTasksAndCloud();
                renderTasks();
                form.reset();
            }
        });
    }

    // Energy Filter Buttons Event Listeners
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentEnergyFilter = e.target.dataset.filter;
            renderTasks();
        });
    });

    const focusBtn = document.getElementById('focus-mode-btn');
    const kanbanCard = document.querySelector('.kanban-card');
    if (focusBtn && kanbanCard) {
        focusBtn.addEventListener('click', () => {
            focusModeActive = !focusModeActive;
            kanbanCard.classList.toggle('focus-mode-active', focusModeActive);
            focusBtn.textContent = focusModeActive ? '🎯 Focus Mode: On' : '🎯 Focus Mode: Off';
            focusBtn.style.background = focusModeActive ? '#313d4f' : '#272e38';
        });
    }

    const clearDoneBtn = document.getElementById('clear-done-btn');
    if (clearDoneBtn) {
        clearDoneBtn.addEventListener('click', () => {
            tasks = tasks.filter(t => t.status !== 'done');
            saveTasksAndCloud();
            renderTasks();
        });
    }

    loadLatestVideos();
    loadSpaceNews();
    setupScratchpad('scratchpad', scratchpadStorageKey);
    renderTasks();
});