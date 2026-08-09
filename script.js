const creators = [
    { name: "MrBeast", channelId: "UCX6OQ3DkcsbYNE6H8uQQuVA" },
    { name: "Beast Gaming", channelId: "UCIPPMRA040LQr5QPyJEbmXA" },
    { name: "Beast Philanthropy", channelId: "UCAiLfjNXkNv24uhpzUgPa6A" },
    { name: "Ryan Trahan", channelId: "UCnmGIkw-KdI0W5siakKPKog" },
    { name: "StarTalk", channelId: "UCqoAEDirJPjEUFcF2FklnBA" },
    { name: "Mumbo Jumbo", channelId: "UChFur_NwVSbUozOcF_F2kMg" }
];

async function loadLatestVideos() {
    const container = document.getElementById('youtube-feed-container');
    container.innerHTML = ''; // Clear loading text

    for (const creator of creators) {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.youtube.com%2Ffeeds%2Fvideos.xml%3Fchannel_id%3D${creator.channelId}`;
        
        try {
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.status === 'ok' && data.items.length > 0) {
                const video = data.items[0]; // Latest video
                const videoId = video.guid.split(':')[2];
                const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                
                // Parse and compare dates for Today/Yesterday or MM/DD/YYYY
                const videoDate = new Date(video.pubDate);
                const today = new Date();
                
                const videoDay = new Date(videoDate.getFullYear(), videoDate.getMonth(), videoDate.getDate());
                const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                
                const diffTime = todayDay - videoDay;
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                
                let dateString = "";
                if (diffDays === 0) {
                    dateString = "Today";
                } else if (diffDays === 1) {
                    dateString = "Yesterday";
                } else if (diffDays === 2) {
                    dateString = "2 days ago";
                } else if (diffDays === 3) {
                    dateString = "3 days ago";
                } else if (diffDays === 4) {
                    dateString = "4 days ago";
                } else if (diffDays === 5) {
                    dateString = "5 days ago";
                } else if (diffDays === 6) {
                    dateString = "6 days ago";
                } else if (diffDays === 7) {
                    dateString = "A week ago";
                } else {
                    const month = String(videoDate.getMonth() + 1).padStart(2, '0');
                    const day = String(videoDate.getDate()).padStart(2, '0');
                    const year = videoDate.getFullYear();
                    dateString = `${month}/${day}/${year}`;
                }

                container.innerHTML += `
                    <a href="${video.link}" target="_blank" class="video-button">
                        <img src="${thumbUrl}" alt="${video.title}">
                        <span class="video-title">${video.title}</span>
                        <small class="video-date">${dateString}</small>
                        <span class="creator-name">${creator.name}</span>
                    </a>
                `;
            } else {
                container.innerHTML += `
                    <a href="https://youtube.com/channel/${creator.channelId}" target="_blank" class="video-button">
                        <img src="https://via.placeholder.com/480x360?text=Visit+Channel" alt="Go to channel">
                        <span class="creator-name">${creator.name}</span>
                        <small class="video-date">View Channel</small>
                    </a>
                `;
            }
        } catch (error) {
            console.error("Failed to load:", creator.name);
        }
    }
}

loadLatestVideos();

// ----- Helper: get a valid range inside a scratchpad (or collapse to end) -----
function getSafeRange(pad) {
    const sel = window.getSelection();
    let range = null;
    if (sel.rangeCount > 0) {
        range = sel.getRangeAt(0);
        // if the range is not inside this pad, discard it
        if (!pad.contains(range.commonAncestorContainer)) {
            range = null;
        }
    }
    if (!range) {
        range = document.createRange();
        range.selectNodeContents(pad);
        range.collapse(false); // to the end
    }
    return range;
}

// ----- Setup each scratchpad with persistence and event handlers -----
setupScratchpad('scratchpad', 'myScratchpad');
setupScratchpad('scratchpad2', 'myScratchpad2');

function setupScratchpad(id, storageKey) {
    const pad = document.getElementById(id);
    if (!pad) return;

    // Load saved content
    pad.innerHTML = localStorage.getItem(storageKey) || '';

    // Save on any change
    pad.addEventListener('input', () => {
        localStorage.setItem(storageKey, pad.innerHTML);
    });
    pad.addEventListener('change', () => {
        localStorage.setItem(storageKey, pad.innerHTML);
    });

    // --- Make links inside the pad clickable (open in new tab) ---
    pad.addEventListener('click', (e) => {
        const anchor = e.target.closest('a');
        if (anchor && anchor.href) {
            e.preventDefault();
            window.open(anchor.href, '_blank');
        }
    });

    // --- Handle paste (images and URLs with display name prompt) ---
    pad.addEventListener('paste', (e) => {
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;

        // 1. Check for pasted image file
        const items = clipboardData.items;
        if (items) {
            for (let item of items) {
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    insertImageBlob(pad, blob, storageKey);
                    return;
                }
            }
        }

        // 2. Check for pasted URL
        const text = clipboardData.getData('text');
        if (text) {
            const cleanText = text.trim();
            const urlPattern = /^(https?:\/\/|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/[^\s]*)?$/i;
            if (urlPattern.test(cleanText)) {
                e.preventDefault();

                // Prompt for display name (default to the URL itself)
                let displayText = prompt("Enter the display text for this link:", cleanText);
                if (displayText === null) return; // cancelled
                if (displayText.trim() === '') displayText = cleanText;

                // Build the anchor
                let href = cleanText;
                if (!/^https?:\/\//i.test(href)) {
                    href = 'https://' + href;
                }
                const a = document.createElement('a');
                a.href = href;
                a.textContent = displayText;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';

                // Insert at current cursor position
                const range = getSafeRange(pad);
                pad.focus();
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                range.deleteContents();
                range.insertNode(a);

                // Move cursor right after the link
                range.setStartAfter(a);
                range.setEndAfter(a);
                sel.removeAllRanges();
                sel.addRange(range);

                localStorage.setItem(storageKey, pad.innerHTML);
            }
        }
    });
}

// ----- Image upload from file input -----
function triggerImageUpload(id) {
    document.getElementById('file-' + id).click();
}

function handleFileSelect(event, id) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const pad = document.getElementById(id);
        const storageKey = id === 'scratchpad' ? 'myScratchpad' : 'myScratchpad2';
        insertImageBlob(pad, file, storageKey);
    }
    event.target.value = ''; // reset
}

function insertImageBlob(pad, blob, storageKey) {
    pad.focus();
    const range = getSafeRange(pad);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = document.createElement('img');
        img.src = event.target.result;
        range.deleteContents();
        range.insertNode(img);
        // Move cursor after the image
        range.setStartAfter(img);
        range.setEndAfter(img);
        sel.removeAllRanges();
        sel.addRange(range);
        localStorage.setItem(storageKey, pad.innerHTML);
    };
    reader.readAsDataURL(blob);
}

// ----- Add a checkbox with editable text -----
function addCheckbox(id) {
    const pad = document.getElementById(id);
    const range = getSafeRange(pad);
    pad.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const wrapper = document.createElement('div');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    const textSpan = document.createElement('span');
    textSpan.textContent = 'New Task';
    wrapper.appendChild(checkbox);
    wrapper.appendChild(document.createTextNode(' '));
    wrapper.appendChild(textSpan);
    wrapper.appendChild(document.createElement('br'));

    range.deleteContents();
    range.insertNode(wrapper);

    // Place cursor inside the text span for immediate editing
    const newRange = document.createRange();
    newRange.selectNodeContents(textSpan);
    sel.removeAllRanges();
    sel.addRange(newRange);

    const storageKey = id === 'scratchpad' ? 'myScratchpad' : 'myScratchpad2';
    localStorage.setItem(storageKey, pad.innerHTML);
}

// ----- Add a list (ordered/unordered) using execCommand -----
function addList(id, command) {
    const pad = document.getElementById(id);
    const range = getSafeRange(pad);
    pad.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    document.execCommand(command, false, null);

    const storageKey = id === 'scratchpad' ? 'myScratchpad' : 'myScratchpad2';
    localStorage.setItem(storageKey, pad.innerHTML);
}

// ----- Add a link (with prompt for URL and display text) -----
function addLink(id) {
    const pad = document.getElementById(id);
    const range = getSafeRange(pad);
    pad.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    let url = prompt("Enter the URL (e.g., https://example.com):");
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }

    const selectedText = sel.toString();
    if (selectedText.length > 0) {
        // If text is highlighted, turn it into a link
        document.execCommand('createLink', false, url);
    } else {
        // No selection: ask for display text
        let displayText = prompt("Enter the text to display for this link:", url);
        if (displayText === null) return;
        if (displayText.trim() === '') displayText = url;

        const a = document.createElement('a');
        a.href = url;
        a.textContent = displayText;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';

        range.deleteContents();
        range.insertNode(a);
        // Move cursor after the link
        range.setStartAfter(a);
        range.setEndAfter(a);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    const storageKey = id === 'scratchpad' ? 'myScratchpad' : 'myScratchpad2';
    localStorage.setItem(storageKey, pad.innerHTML);
}