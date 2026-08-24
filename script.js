/* =========================================================================
   1. KANBAN TASK BOARD LOGIC (Page-Aware Storage)
   ========================================================================= */
const isAddonPage = window.location.pathname.includes('addon.html');
const kanbanStorageKey = isAddonPage ? 'kanban_tasks_addon' : 'kanban_tasks';
const scratchpadStorageKey = isAddonPage ? 'myScratchpad_addon' : 'myScratchpad';

let tasks = JSON.parse(localStorage.getItem(kanbanStorageKey)) || [
    { id: '1', title: isAddonPage ? 'Check Elytra model textures' : 'Review JavaScript logic on Scrimba', status: 'todo', energy: 'medium', time: '20m' },
    { id: '2', title: isAddonPage ? 'Test Bedrock addon in-game' : 'Refactor Control Center Grid layout', status: 'inprogress', energy: 'high', time: '30m' }
];

let focusModeActive = false;

function saveTasks() {
    localStorage.setItem(kanbanStorageKey, JSON.stringify(tasks));
}

function renderTasks() {
    const todoList = document.getElementById('todo-list');
    const inprogressList = document.getElementById('inprogress-list');
    const doneList = document.getElementById('done-list');

    if (!todoList || !inprogressList || !doneList) return;

    todoList.innerHTML = '';
    inprogressList.innerHTML = '';
    doneList.innerHTML = '';

    tasks.forEach(task => {
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
        saveTasks();
        renderTasks();
    }
}

function toggleTaskComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.status = task.status === 'done' ? 'todo' : 'done';
        saveTasks();
        renderTasks();
    }
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
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
    // To get the channelId ("UC..."). On channel page press Ctrl+U and Ctrl+F then PASTE "channel_id"
    { name: "MrBeast", channelId: "UCX6OQ3DkcsbYNE6H8uQQuVA" },
    { name: "Beast Gaming", channelId: "UCIPPMRA040LQr5QPyJEbmXA" },
    { name: "Beast Philanthropy", channelId: "UCAiLfjNXkNv24uhpzUgPa6A" },
    { name: "Ryan Trahan", channelId: "UCnmGIkw-KdI0W5siakKPKog" },
    { name: "StarTalk", channelId: "UCqoAEDirJPjEUFcF2FklnBA" },
    { name: "Mumbo Jumbo", channelId: "UChFur_NwVSbUozOcF_F2kMg" },
    { name: "Coridor Crew", channelId: "UCSpFnDQr88xCZ80N-X7t0nQ" },
    { name: "Dylan Page", channelId: "UCzPpbeK8ANcNKg5aoMB0miw" }
    // { name: "Channel Name", channelId: "UC....." }
];

async function loadLatestVideos() {
    const container = document.getElementById('youtube-feed-container');
    if (!container) return; // Safely skip if page doesn't have this feed

    container.innerHTML = 'Loading YouTube feed...';
    let allVideos = [];

    // 1. Fetch videos from all creators
    for (const creator of creators) {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.youtube.com%2Ffeeds%2Fvideos.xml%3Fchannel_id%3D${creator.channelId}`;
        try {
            const response = await fetch(apiUrl);
            const data = await response.json();
            if (data.status === 'ok' && data.items.length > 0) {
                const video = data.items.find(item => !item.link.includes('/shorts/'));
                if (!video) continue;
                const videoId = video.guid.split(':')[2];
                const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                
                const videoDate = new Date(video.pubDate);
                const today = new Date();
                const diffTime = today - videoDate;
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                let dateString = "";
                if (diffDays === 0) {
                    dateString = "Today";
                } else if (diffDays === 1) {
                    dateString = "Yesterday";
                } else if (diffDays <= 29) {
                    dateString = `${diffDays} days ago`;
                } else if (diffDays < 365) {
                    const diffMonths = Math.floor(diffDays / 30);
                    dateString = diffMonths === 1 ? "1 month ago" : `${diffMonths} months ago`;
                } else {
                    const diffYears = Math.floor(diffDays / 365);
                    dateString = diffYears === 1 ? "1 year ago" : `${diffYears} years ago`;
                }

                // Push object into our collection array
                allVideos.push({
                    title: video.title,
                    link: video.link,
                    thumbUrl: thumbUrl,
                    pubDate: videoDate,
                    dateString: dateString,
                    creatorName: creator.name
                });
            }
        } catch (error) { 
            console.error("Failed to load:", creator.name); 
        }
    }

    // 2. Sort videos by date in descending order (newest first)
    allVideos.sort((a, b) => b.pubDate - a.pubDate);

    // 3. Clear container and render the sorted list
    container.innerHTML = '';
    
    if (allVideos.length === 0) {
        container.innerHTML = '<p>No videos found.</p>';
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
   3. SCRATCHPAD LOGIC
   ========================================================================= */
function setupScratchpad(id, storageKey) {
    const pad = document.getElementById(id);
    if (!pad) return;
    pad.innerHTML = localStorage.getItem(storageKey) || '';
    pad.addEventListener('input', () => localStorage.setItem(storageKey, pad.innerHTML));
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
    localStorage.setItem(scratchpadStorageKey, pad.innerHTML);
}

function triggerImageUpload(id) { document.getElementById('file-' + id).click(); }

function handleFileSelect(event, id) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.execCommand('insertImage', false, e.target.result);
            localStorage.setItem(scratchpadStorageKey, document.getElementById(id).innerHTML);
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}

/* =========================================================================
   4. INIT
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
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
                saveTasks();
                renderTasks();
                form.reset();
            }
        });
    }

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
            saveTasks();
            renderTasks();
        });
    }

    loadLatestVideos();
    loadSpaceNews();
    setupScratchpad('scratchpad', scratchpadStorageKey);
    renderTasks();
});

/* =========================================================================
   5. SPACE NEWS
   ========================================================================= */
async function loadSpaceNews() {
    const container = document.getElementById('space-news-container');
    if (!container) return; // Safely skip if page doesn't have space news
    
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