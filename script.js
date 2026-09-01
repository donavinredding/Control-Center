/* =========================================================================
   SUPABASE INITIALIZATION
   ========================================================================= */
const SUPABASE_URL = 'https://gxlpmwepweujpbumyqvb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4bHBtd2Vwd2V1anBidW15cXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NDQ0MTQsImV4cCI6MjEwMzQyMDQxNH0.adwwoQTQ4B1iSUJeTpP1D3FPee0yRdCx_vlwqDGwim0';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
const isAddonPage = window.location.pathname.includes('addon.html');

let tasks = [];
let focusModeActive = false;
let currentEnergyFilter = 'all';


/* =========================================================================
   AUTHENTICATION & INITIALIZATION
   ========================================================================= */
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        // Show login container
        const authContainer = document.getElementById('auth-container');
        if (authContainer) authContainer.style.display = 'block';
        
        // Universally hide the main content across all pages
        const mainContent = document.querySelector('main');
        if (mainContent) mainContent.style.display = 'none';
        
        // Hide navigation and logout widget
        const siteNav = document.querySelector('.site-nav');
        if (siteNav) siteNav.style.display = 'none';
        
        const logoutContainer = document.getElementById('logout-container');
        if (logoutContainer) logoutContainer.style.display = 'none';
    } else {
        currentUser = session.user;
        initDashboard();
    }

    setupAuthUIEvents();
    initEventListeners();
});

async function handleLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (error) {
        document.getElementById('auth-error').textContent = error.message;
    } else {
        location.reload();
    }
}

// Opens the custom logout confirmation modal (APK friendly)
function handleLogout() {
    const modal = document.getElementById('logout-modal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        if (window.confirm("Are you sure you want to log out of your Control Center?")) {
            confirmLogout();
        }
    }
}

// Closes the custom logout modal
function closeLogoutModal() {
    const modal = document.getElementById('logout-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Executes the actual Supabase sign-out
async function confirmLogout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        window.location.reload();
    } catch (error) {
        console.error("Error logging out:", error.message);
        alert("Failed to log out. Please check your connection and try again.");
    }
}

function setupAuthUIEvents() {
    if (currentUser) {
        const logoutContainer = document.getElementById('logout-container');
        const userDisplay = document.getElementById('user-display');
        if (logoutContainer) logoutContainer.style.display = 'block';
        if (userDisplay) userDisplay.textContent = currentUser.email;
    }
}

async function initDashboard() {
    const authContainer = document.getElementById('auth-container');
    if (authContainer) authContainer.style.display = 'none';

    // Show main content and layouts when logged in
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.style.display = ''; // resets to default CSS display

    const hubGrid = document.querySelector('.hub-grid');
    if (hubGrid) hubGrid.style.display = 'grid';

    const siteNav = document.querySelector('.site-nav');
    if (siteNav) siteNav.style.display = ''; 

    const logoutContainer = document.getElementById('logout-container');
    if (logoutContainer) logoutContainer.style.display = 'block';
    
    const userDisplay = document.getElementById('user-display');
    if (userDisplay && currentUser) userDisplay.textContent = currentUser.email;

    // Optional safe calls if functions exist on the current page
    if (typeof fetchTasksFromCloud === 'function') await fetchTasksFromCloud();
    if (typeof loadLatestVideos === 'function') loadLatestVideos();
    if (typeof loadSpaceNews === 'function') loadSpaceNews();
    if (typeof setupScratchpadCloud === 'function') setupScratchpadCloud('scratchpad');
}


/* =========================================================================
   1. KANBAN TASK BOARD LOGIC (Cloud Synchronized)
   ========================================================================= */
async function fetchTasksFromCloud() {
    const { data, error } = await supabaseClient
        .from('tasks')
        .select('*')
        .eq('user_id', currentUser.id);

    if (error) {
        console.error('Error fetching tasks:', error);
        return;
    }

    if (data && data.length > 0) {
        tasks = data;
    }
    renderTasks();
}

async function saveTaskToCloud(task) {
    task.user_id = currentUser.id;
    await supabaseClient.from('tasks').upsert(task);
}

async function deleteTaskFromCloud(id) {
    await supabaseClient.from('tasks').delete().eq('id', id).eq('user_id', currentUser.id);
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
            moveButtonsHtml = `<button class="task-move-btn" onclick="moveTask('${task.id}', 'inprogress')">➔</button>`;
        } else if (task.status === 'inprogress') {
            moveButtonsHtml = `
                <button class="task-move-btn" onclick="moveTask('${task.id}', 'todo')">⬅</button>
                <button class="task-move-btn" onclick="moveTask('${task.id}', 'done')">➔</button>
            `;
        } else if (task.status === 'done') {
            moveButtonsHtml = `<button class="task-move-btn" onclick="moveTask('${task.id}', 'inprogress')">⬅</button>`;
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
                    <button class="task-delete-btn" onclick="deleteTask('${task.id}')">🗑️</button>
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

async function moveTask(id, newStatus) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.status = newStatus;
        await saveTaskToCloud(task);
        renderTasks();
    }
}

async function toggleTaskComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.status = task.status === 'done' ? 'todo' : 'done';
        await saveTaskToCloud(task);
        renderTasks();
    }
}

async function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    await deleteTaskFromCloud(id);
    renderTasks();
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}


/* =========================================================================
   2. YOUTUBE FEED LOGIC
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
                    const diffDays = Math.floor((new Date() - videoDate) / (1000 * 60 * 60 * 24));
                    
                    let dateString = diffDays === 0 ? "Today" : diffDays === 1 ? "Yesterday" : `${diffDays} days ago`;
                    if (diffDays > 29) dateString = `${Math.floor(diffDays / 30)} months ago`;

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
        } catch (error) { console.error("Failed to load:", creator.name); }
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    allVideos.sort((a, b) => b.pubDate - a.pubDate);
    container.innerHTML = allVideos.length === 0 ? '<p>No videos found.</p>' : '';
    
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
   3. SCRATCHPAD LOGIC
   ========================================================================= */
async function setupScratchpadCloud(id) {
    const pad = document.getElementById(id);
    if (!pad) return;

    const { data } = await supabaseClient
        .from('scratchpad')
        .select('content')
        .eq('user_id', currentUser.id)
        .single();

    if (data) {
        pad.innerHTML = data.content || '';
    }

    let timeoutId;
    pad.addEventListener('input', () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
            await supabaseClient.from('scratchpad').upsert({
                user_id: currentUser.id,
                content: pad.innerHTML
            });
        }, 800);
    });

    pad.addEventListener('click', (e) => {
        const anchor = e.target.closest('a');
        if (anchor && anchor.href) { 
            e.preventDefault(); 
            window.open(anchor.href, '_blank'); 
        }
    });

    pad.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        const urlRegex = /^(https?:\/\/[^\s]+|[a-zA-Z0-9][-a-zA-Z0-90-9]*\.[a-zA-Z]{2,}[^\s]*)$/;
        
        if (urlRegex.test(text.trim())) {
            const cleanUrl = text.trim().startsWith('http') ? text.trim() : 'https://' + text.trim();
            insertHtmlAtCursor(`<a href="${cleanUrl}" target="_blank">${cleanUrl}</a>&nbsp;`);
        } else {
            insertHtmlAtCursor(text);
        }
        pad.dispatchEvent(new Event('input'));
    });

    pad.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const node = range.startContainer;
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent;
                    const words = text.split(/\s+/);
                    const lastWord = words[words.length - 1];
                    
                    if (lastWord && (lastWord.startsWith('http://') || lastWord.startsWith('https://') || (lastWord.includes('.') && !lastWord.endsWith('.')))) {
                        const cleanUrl = lastWord.startsWith('http') ? lastWord : 'https://' + lastWord;
                        const leadingText = text.substring(0, text.length - lastWord.length);
                        
                        const span = document.createElement('span');
                        span.textContent = leadingText;
                        
                        const a = document.createElement('a');
                        a.href = cleanUrl;
                        a.textContent = lastWord;
                        a.target = '_blank';
                        
                        const parent = node.parentNode;
                        parent.insertBefore(span, node);
                        parent.insertBefore(a, node);
                        
                        const spaceNode = document.createTextNode(e.key === ' ' ? ' ' : '\n');
                        parent.insertBefore(spaceNode, node);
                        parent.removeChild(node);
                        
                        range.setStartAfter(spaceNode);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                        
                        e.preventDefault();
                        pad.dispatchEvent(new Event('input'));
                    }
                }
            }
        }
    });
}

function insertHtmlAtCursor(html) {
    const sel = window.getSelection();
    if (sel.getRangeAt && sel.rangeCount) {
        let range = sel.getRangeAt(0);
        range.deleteContents();
        let el = document.createElement("div");
        el.innerHTML = html;
        let frag = document.createDocumentFragment(), node, lastNode;
        while ((node = el.firstChild)) {
            lastNode = frag.appendChild(node);
        }
        range.insertNode(frag);
        if (lastNode) {
            range = range.cloneRange();
            range.setStartAfter(lastNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
}

function addLink(id) {
    const pad = document.getElementById(id);
    if (!pad) return;
    pad.focus(); 
    
    const url = prompt("Enter URL:");
    if (!url) return;
    const cleanUrl = url.startsWith('http') ? url : 'https://' + url;
    
    insertHtmlAtCursor(`<a href="${cleanUrl}" target="_blank">${cleanUrl}</a>&nbsp;`);
    pad.dispatchEvent(new Event('input')); 
}

function triggerImageUpload(id) { 
    document.getElementById('file-' + id).click(); 
}

function handleFileSelect(event, id) {
    const pad = document.getElementById(id);
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            if (pad) {
                pad.focus(); 
                insertHtmlAtCursor(`<img src="${e.target.result}" alt="Uploaded Image">`);
                pad.dispatchEvent(new Event('input')); 
            }
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}


/* =========================================================================
   4. SPACE NEWS LOGIC
   ========================================================================= */
async function loadSpaceNews() {
    const container = document.getElementById('space-news-container');
    if (!container) return;
    
    try {
        const response = await fetch('https://api.spaceflightnewsapi.net/v4/articles/?limit=6');
        const data = await response.json();
        if (data.results) {
            container.innerHTML = '';
            data.results.forEach(article => {
                const pubDate = new Date(article.published_at);
                container.innerHTML += `
                    <a href="${article.url}" target="_blank" class="space-news-card">
                        <img src="${article.image_url}" alt="${article.title}">
                        <div class="space-news-content">
                            <span class="space-news-title">${article.title}</span>
                            <small class="space-news-date">${pubDate.toLocaleDateString()} • ${article.news_site}</small>
                        </div>
                    </a>
                `;
            });
        }
    } catch (error) {
        container.innerHTML = '<p style="color: red;">Failed to load space news.</p>';
    }
}


/* =========================================================================
   5. UI EVENT LISTENERS INITIALIZATION
   ========================================================================= */
function initEventListeners() {
    const form = document.getElementById('task-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newTask = {
                id: Date.now().toString(),
                user_id: currentUser ? currentUser.id : null,
                title: document.getElementById('task-title').value.trim(),
                status: 'todo',
                energy: document.getElementById('task-energy').value,
                time: document.getElementById('task-time').value.trim()
            };
            if (newTask.title && newTask.user_id) {
                tasks.push(newTask);
                await saveTaskToCloud(newTask);
                renderTasks();
                form.reset();
            }
        });
    }

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
        });
    }

    const clearDoneBtn = document.getElementById('clear-done-btn');
    if (clearDoneBtn) {
        clearDoneBtn.addEventListener('click', async () => {
            const doneTasks = tasks.filter(t => t.status === 'done');
            for (let t of doneTasks) {
                await deleteTaskFromCloud(t.id);
            }
            tasks = tasks.filter(t => t.status !== 'done');
            renderTasks();
        });
    }
}