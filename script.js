/* =========================================================================
   SUPABASE INITIALIZATION
   ========================================================================= */

const SUPABASE_URL = 'https://gxlpmwepweujpbumyqvb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4bHBtd2Vwd2V1anBidW15cXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NDQ0MTQsImV4cCI6MjEwMzQyMDQxNH0.adwwoQTQ4B1iSUJeTpP1D3FPee0yRdCx_vlwqDGwim0';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let tasks = [];
let focusModeActive = false;
let currentEnergyFilter = 'all';

/* =========================================================================
   HELPER: Get Unique Project ID based on current HTML filename
   ========================================================================= */
function getCurrentProjectId() {
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1);
    if (!filename || filename === '' || filename === 'index.html') {
        return 'main';
    }
    return filename.replace('.html', '');
}


/* =========================================================================
   AUTHENTICATION & INITIALIZATION
   ========================================================================= */
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        const authContainer = document.getElementById('auth-container');
        if (authContainer) authContainer.style.display = 'block';

        const mainContent = document.querySelector('main');
        if (mainContent) mainContent.style.display = 'none';

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

function closeLogoutModal() {
    const modal = document.getElementById('logout-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

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

    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.style.display = '';

    const hubGrid = document.querySelector('.hub-grid');
    if (hubGrid) hubGrid.style.display = 'grid';

    const siteNav = document.querySelector('.site-nav');
    if (siteNav) siteNav.style.display = '';

    const logoutContainer = document.getElementById('logout-container');
    if (logoutContainer) logoutContainer.style.display = 'block';

    const userDisplay = document.getElementById('user-display');
    if (userDisplay && currentUser) userDisplay.textContent = currentUser.email;

    if (typeof fetchTasksFromCloud === 'function') await fetchTasksFromCloud();
    if (typeof fetchProjects === 'function') fetchProjects();
    if (typeof loadLatestVideos === 'function') loadLatestVideos();
    if (typeof loadSpaceNews === 'function') loadSpaceNews();
    if (typeof setupScratchpadCloud === 'function') setupScratchpadCloud('scratchpad');
    if (typeof setupIdeasCloud === 'function') setupIdeasCloud();
}


/* =========================================================================
   1. KANBAN TASK BOARD LOGIC
   ========================================================================= */
async function fetchTasksFromCloud() {
    const projectId = getCurrentProjectId();
    const { data, error } = await supabaseClient
        .from('tasks')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('project_id', projectId);

    if (error) {
        console.error('Error fetching tasks:', error);
        return;
    }

    tasks = data || [];
    renderTasks();
}

async function saveTaskToCloud(task) {
    task.user_id = currentUser.id;
    task.project_id = getCurrentProjectId();
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

    const boxBtnStyle = "background: #272e38; border: 1px solid #3f4a5a; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 0.95rem; display: inline-flex; align-items: center; justify-content: center; color: #e3e8ef; transition: background 0.2s;";

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
            moveButtonsHtml = `<button class="task-move-btn" style="${boxBtnStyle}" onclick="moveTask('${task.id}', 'inprogress')" title="Move to In Progress">➡️</button>`;
        } else if (task.status === 'inprogress') {
            moveButtonsHtml = `
                <button class="task-move-btn" style="${boxBtnStyle}" onclick="moveTask('${task.id}', 'todo')" title="Move to To Do">⬅️</button>
                <button class="task-move-btn" style="${boxBtnStyle}" onclick="moveTask('${task.id}', 'done')" title="Move to Done">➡️</button>
            `;
        } else if (task.status === 'done') {
            moveButtonsHtml = `<button class="task-move-btn" style="${boxBtnStyle}" onclick="moveTask('${task.id}', 'inprogress')" title="Move to In Progress">⬅️</button>`;
        }

        const isDone = task.status === 'done';

        card.innerHTML = `
            <div class="task-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <div class="task-title-area" style="display: flex; align-items: center; gap: 8px; flex: 1;">
                    <input type="checkbox" class="task-checkbox" ${isDone ? 'checked' : ''} onchange="toggleTaskComplete('${task.id}')">
                    <p class="task-title" style="${isDone ? 'text-decoration: line-through; opacity: 0.6;' : ''}; margin: 0;">${escapeHtml(task.title)}</p>
                </div>
                <button class="task-delete-btn" onclick="deleteTask('${task.id}')" title="Delete Task" style="background: rgba(224,108,117,0.15); border: 1px solid rgba(224,108,117,0.3); border-radius: 6px; color: #e06c75; cursor: pointer; font-size: 0.85rem; padding: 5px 8px; line-height: 1;">🗑️</button>
            </div>
            <div class="task-meta" style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 2px;">
                <div class="task-info-center" style="display: flex; gap: 6px; align-items: center;">
                    <span class="task-tag">${task.energy.toUpperCase()}</span>
                    ${task.time ? `<span class="task-tag">⏱️ ${escapeHtml(task.time)}</span>` : ''}
                </div>
                <div class="task-actions" style="display: flex; gap: 6px;">
                    ${moveButtonsHtml}
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

let taskToDeleteId = null;

function deleteTask(id) {
    taskToDeleteId = id;
    let modal = document.getElementById('delete-confirm-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'delete-confirm-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 9999;';
        modal.innerHTML = `
            <div style="background: #313843; border: 1px solid #3f4a5a; padding: 24px; border-radius: 12px; width: 90%; max-width: 320px; text-align: center; color: #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 1.1rem; color: #f0f4f8;">Delete Task?</h3>
                <p style="color: #9aa5b1; font-size: 0.9rem; margin-bottom: 20px;">Are you sure you want to delete this task?</p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="cancel-delete-btn" style="background: #272e38; border: 1px solid #3f4a5a; color: #e3e8ef; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; flex: 1;">Cancel</button>
                    <button id="confirm-delete-btn" style="background: #e06c75; border: none; color: #fff; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; flex: 1;">Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('cancel-delete-btn').addEventListener('click', () => {
            modal.style.display = 'none';
            taskToDeleteId = null;
        });

        document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
            if (taskToDeleteId) {
                tasks = tasks.filter(t => t.id !== taskToDeleteId);
                await deleteTaskFromCloud(taskToDeleteId);
                renderTasks();
            }
            modal.style.display = 'none';
            taskToDeleteId = null;
        });
    } else {
        modal.style.display = 'flex';
    }
}

function clearDoneTasks() {
    let modal = document.getElementById('clear-done-confirm-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'clear-done-confirm-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 9999;';
        modal.innerHTML = `
            <div style="background: #313843; border: 1px solid #3f4a5a; padding: 24px; border-radius: 12px; width: 90%; max-width: 320px; text-align: center; color: #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 1.1rem; color: #f0f4f8;">Clear Done Tasks?</h3>
                <p style="color: #9aa5b1; font-size: 0.9rem; margin-bottom: 20px;">Are you sure you want to clear all completed tasks?</p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="cancel-clear-done-btn" style="background: #272e38; border: 1px solid #3f4a5a; color: #e3e8ef; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; flex: 1;">Cancel</button>
                    <button id="confirm-clear-done-btn" style="background: #e06c75; border: none; color: #fff; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; flex: 1;">Clear</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('cancel-clear-done-btn').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        document.getElementById('confirm-clear-done-btn').addEventListener('click', async () => {
            const doneTasks = tasks.filter(t => t.status === 'done');
            for (let t of doneTasks) {
                await deleteTaskFromCloud(t.id);
            }
            tasks = tasks.filter(t => t.status !== 'done');
            renderTasks();
            modal.style.display = 'none';
        });
    } else {
        modal.style.display = 'flex';
    }
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function escapeAttr(text) {
    if (!text) return '';
    return escapeHtml(text);
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
                    const diffDays = Math.max(0, Math.floor((new Date() - videoDate) / (1000 * 60 * 60 * 24)));

                    let dateString = diffDays === 0 ? "Today" : diffDays === 1 ? "Yesterday" : `${diffDays} days ago`;
                    if (diffDays > 29) dateString = `${Math.floor(diffDays / 30)} months ago`;

                    allVideos.push({
                        title: video.title,
                        videoId: videoId,
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
        const card = document.createElement('div');
        card.className = 'video-button';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <img src="${video.thumbUrl}" alt="${escapeHtml(video.title)}">
            <span class="video-title">${escapeHtml(video.title)}</span>
            <small class="video-date">${video.dateString}</small>
            <span class="creator-name">${video.creatorName}</span>
        `;
        card.addEventListener('click', () => {
            handleVideoClick(video.videoId);
        });
        container.appendChild(card);
    });
}

function handleVideoClick(videoId) {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

    if (isMobile) {
        window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
    } else {
        openPopupPlayer(videoId);
    }
}

function openPopupPlayer(videoId, startTime = '') {
    const width = 480;
    const height = 270;
    const left = window.screen.width - width - 30;
    const top = window.screen.height - height - 100;
    
    let watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    if (startTime) {
        watchUrl += `&t=${startTime}`;
    }
    
    window.open(
        watchUrl,
        'YouTubePiPWindow',
        `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=no,status=no`
    );
}


/* =========================================================================
   3. SCRATCHPAD & IDEAS CLOUD LOGIC
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

async function setupIdeasCloud() {
    const ideaInputs = document.querySelectorAll('.idea-input, .idea-box, textarea.idea, input.idea');
    if (ideaInputs.length === 0) return;

    ideaInputs.forEach((el, index) => {
        if (!el.id) el.id = `idea-field-${index}`;
    });

    const { data } = await supabaseClient
        .from('ideas')
        .select('content')
        .eq('user_id', currentUser.id)
        .single();

    let savedData = {};
    if (data && data.content) {
        try {
            savedData = typeof data.content === 'object' ? data.content : JSON.parse(data.content);
        } catch (e) {
            savedData = {};
        }
    }

    ideaInputs.forEach(el => {
        if (savedData[el.id] !== undefined) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.value = savedData[el.id];
            } else {
                el.innerHTML = savedData[el.id];
            }
        }
    });

    let timeoutId;
    ideaInputs.forEach(el => {
        el.addEventListener('input', () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(async () => {
                const currentValues = {};
                ideaInputs.forEach(input => {
                    currentValues[input.id] = (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') ? input.value : input.innerHTML;
                });

                await supabaseClient.from('ideas').upsert({
                    user_id: currentUser.id,
                    content: currentValues
                });
            }, 800);
        });
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

function openLinkModal(id) {
    addLink(id);
}

function addLink(id) {
    const pad = document.getElementById(id);
    if (!pad) return;

    let modal = document.getElementById('custom-link-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-link-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 9999;';
        modal.innerHTML = `
            <div style="background: #313843; border: 1px solid #61afef; padding: 24px; border-radius: 12px; width: 90%; max-width: 340px; text-align: center; color: #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 1.1rem; color: #f0f4f8;">Insert Link</h3>
                <input type="text" id="custom-link-url-input" placeholder="https://example.com" style="width: 100%; padding: 10px; margin-bottom: 12px; background: #272e38; border: 1px solid #3f4a5a; border-radius: 6px; color: #e3e8ef; font-size: 0.95rem; box-sizing: border-box; outline: none;">
                <input type="text" id="custom-link-text-input" placeholder="Link text (optional)" style="width: 100%; padding: 10px; margin-bottom: 20px; background: #272e38; border: 1px solid #3f4a5a; border-radius: 6px; color: #e3e8ef; font-size: 0.95rem; box-sizing: border-box; outline: none;">
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="cancel-link-btn" style="background: #272e38; border: 1px solid #3f4a5a; color: #e3e8ef; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; flex: 1;">Cancel</button>
                    <button id="confirm-link-btn" style="background: #61afef; border: none; color: #181c22; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; flex: 1;">Add</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('cancel-link-btn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    const urlInput = document.getElementById('custom-link-url-input');
    const textInput = document.getElementById('custom-link-text-input');
    urlInput.value = '';
    textInput.value = '';
    modal.style.display = 'flex';
    urlInput.focus();

    const confirmBtn = document.getElementById('confirm-link-btn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) {
            modal.style.display = 'none';
            return;
        }
        const cleanUrl = url.startsWith('http') ? url : 'https://' + url;
        const linkText = textInput.value.trim() || cleanUrl;

        pad.focus();
        insertHtmlAtCursor(`<a href="${cleanUrl}" target="_blank">${escapeHtml(linkText)}</a>&nbsp;`);
        pad.dispatchEvent(new Event('input'));

        modal.style.display = 'none';
    });
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
        container.innerHTML = '<p style="color: #e06c75;">Failed to load space news.</p>';
    }
}


/* =========================================================================
   5. PROJECTS SHOWROOM LOGIC
   ========================================================================= */
async function fetchProjects() {
    const container = document.getElementById('projects-list-container');
    if (!container) return;
    
    container.innerHTML = '<p style="opacity: 0.7; text-align: center; grid-column: 1 / -1; padding: 2rem;">Loading projects...</p>';
    
    const { data, error } = await supabaseClient
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching projects:', error.message);
        container.innerHTML = '<p style="color: #e06c75; text-align: center; grid-column: 1 / -1; padding: 2rem;">Failed to load projects.</p>';
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p style="opacity: 0.7; text-align: center; grid-column: 1 / -1; padding: 3rem; background: #272e38; border: 1px solid #3f4a5a; border-radius: 8px;">No projects added yet.</p>';
        return;
    }

    container.innerHTML = '';
    data.forEach(proj => {
        const card = document.createElement('section');
        card.className = 'card project-showcase-card';

        const imageThumbnail = proj.image_url 
            ? `<div class="project-card-image-wrap"><img src="${proj.image_url}" alt="Project Image" class="project-card-img"></div>` 
            : `<div class="project-card-image-wrap placeholder-wrap"><span>📁</span></div>`;

        const externalLinkBadge = proj.external_link 
            ? `<a href="${proj.external_link}" target="_blank" class="project-external-badge" title="External Link">🔗 Visit Link</a>` 
            : '';

        card.innerHTML = `
            <div class="project-card-inner">
                ${imageThumbnail}
                <div class="project-card-content">
                    <div class="project-card-top-row">
                        <h2 class="project-card-title">${escapeHtml(proj.title)}</h2>
                        ${externalLinkBadge}
                    </div>
                    <p class="project-card-desc">${escapeHtml(proj.description || 'No description provided.')}</p>
                </div>
            </div>
            <div class="project-card-footer">
                <a href="project.html?id=${proj.id}" class="project-hub-link">Open Hub &rarr;</a>
                <div class="project-card-actions">
                    <button type="button" class="project-action-btn edit-btn" 
                        data-id="${proj.id}" 
                        data-title="${escapeAttr(proj.title)}" 
                        data-desc="${escapeAttr(proj.description || '')}" 
                        data-link="${escapeAttr(proj.external_link || '')}" 
                        onclick="handleCardEditClick(this)">✏️ Edit</button>
                    <button type="button" class="project-action-btn delete-btn" onclick="openDeleteModal('${proj.id}')">🗑️ Delete</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

let projectToDeleteId = null;

function openDeleteModal(id) {
    projectToDeleteId = id;
    let modal = document.getElementById('project-delete-confirm-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'project-delete-confirm-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 9999;';
        modal.innerHTML = `
            <div style="background: #313843; border: 1px solid #3f4a5a; padding: 24px; border-radius: 12px; width: 90%; max-width: 320px; text-align: center; color: #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 1.1rem; color: #f0f4f8;">Delete Project?</h3>
                <p style="color: #9aa5b1; font-size: 0.9rem; margin-bottom: 20px;">Are you sure you want to delete this project?</p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="cancel-project-delete-btn" style="background: #272e38; border: 1px solid #3f4a5a; color: #e3e8ef; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; flex: 1;">Cancel</button>
                    <button id="confirm-project-delete-btn" style="background: #e06c75; border: none; color: #fff; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; flex: 1;">Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('cancel-project-delete-btn').addEventListener('click', () => {
            modal.style.display = 'none';
            projectToDeleteId = null;
        });

        document.getElementById('confirm-project-delete-btn').addEventListener('click', async () => {
            if (projectToDeleteId) {
                const { error } = await supabaseClient.from('projects').delete().eq('id', projectToDeleteId).eq('user_id', currentUser.id);
                if (error) {
                    console.error('Error deleting project:', error.message);
                    alert('Failed to delete project.');
                } else {
                    fetchProjects();
                }
            }
            modal.style.display = 'none';
            projectToDeleteId = null;
        });
    } else {
        modal.style.display = 'flex';
    }
}

function handleCardEditClick(btn) {
    const id = btn.dataset.id;
    const title = btn.dataset.title;
    const desc = btn.dataset.desc;
    const link = btn.dataset.link;

    let modal = document.getElementById('project-edit-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'project-edit-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 9999;';
        modal.innerHTML = `
            <div style="background: #313843; border: 1px solid #3f4a5a; padding: 24px; border-radius: 12px; width: 90%; max-width: 400px; color: #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 1.2rem; color: #f0f4f8;">Edit Project</h3>
                <form id="edit-project-form">
                    <input type="hidden" id="edit-project-id">
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; font-size: 0.85rem; color: #9aa5b1; margin-bottom: 4px;">Title</label>
                        <input type="text" id="edit-project-title" required style="width: 100%; padding: 10px; background: #272e38; border: 1px solid #3f4a5a; border-radius: 6px; color: #e3e8ef; box-sizing: border-box;">
                    </div>
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; font-size: 0.85rem; color: #9aa5b1; margin-bottom: 4px;">Description</label>
                        <textarea id="edit-project-desc" rows="3" style="width: 100%; padding: 10px; background: #272e38; border: 1px solid #3f4a5a; border-radius: 6px; color: #e3e8ef; box-sizing: border-box; resize: vertical;"></textarea>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-size: 0.85rem; color: #9aa5b1; margin-bottom: 4px;">External Link</label>
                        <input type="text" id="edit-project-link" style="width: 100%; padding: 10px; background: #272e38; border: 1px solid #3f4a5a; border-radius: 6px; color: #e3e8ef; box-sizing: border-box;">
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" id="cancel-project-edit-btn" style="background: #272e38; border: 1px solid #3f4a5a; color: #e3e8ef; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">Cancel</button>
                        <button type="submit" style="background: #61afef; border: none; color: #181c22; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold;">Save Changes</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('cancel-project-edit-btn').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        document.getElementById('edit-project-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const projId = document.getElementById('edit-project-id').value;
            const updatedTitle = document.getElementById('edit-project-title').value.trim();
            const updatedDesc = document.getElementById('edit-project-desc').value.trim();
            const updatedLink = document.getElementById('edit-project-link').value.trim();

            const { error } = await supabaseClient
                .from('projects')
                .update({ title: updatedTitle, description: updatedDesc, external_link: updatedLink })
                .eq('id', projId)
                .eq('user_id', currentUser.id);

            if (error) {
                console.error('Error updating project:', error.message);
                alert('Failed to update project.');
            } else {
                fetchProjects();
                modal.style.display = 'none';
            }
        });
    }

    document.getElementById('edit-project-id').value = id;
    document.getElementById('edit-project-title').value = title;
    document.getElementById('edit-project-desc').value = desc;
    document.getElementById('edit-project-link').value = link;
    modal.style.display = 'flex';
}


/* =========================================================================
   6. UI EVENT LISTENERS INITIALIZATION
   ========================================================================= */
function initEventListeners() {
    const form = document.getElementById('task-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newTask = {
                id: Date.now().toString(),
                user_id: currentUser ? currentUser.id : null,
                project_id: getCurrentProjectId(),
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
        clearDoneBtn.addEventListener('click', () => {
            const doneTasks = tasks.filter(t => t.status === 'done');
            if (doneTasks.length > 0) {
                clearDoneTasks();
            }
        });
    }
}