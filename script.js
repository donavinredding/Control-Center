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

// --- Reusable Scratchpad Logic for Multiple Pads ---
setupScratchpad('scratchpad', 'myScratchpad');
setupScratchpad('scratchpad2', 'myScratchpad2');

function setupScratchpad(id, storageKey) {
    const pad = document.getElementById(id);
    if (!pad) return;

    // Load saved content on refresh
    pad.innerHTML = localStorage.getItem(storageKey) || '';

    // Save on input or checkbox change
    pad.addEventListener('input', () => {
        localStorage.setItem(storageKey, pad.innerHTML);
    });
    pad.addEventListener('change', () => {
        localStorage.setItem(storageKey, pad.innerHTML);
    });

    // Handle pasting images or links
    pad.addEventListener('paste', (e) => {
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;

        // 1. Check if pasted content is an image file
        const items = clipboardData.items;
        if (items) {
            for (let index in items) {
                let item = items[index];
                if (item.kind === 'file') {
                    let blob = item.getAsFile();
                    if (blob && blob.type.startsWith('image/')) {
                        e.preventDefault();
                        insertImageBlob(pad, blob, storageKey);
                        return;
                    }
                }
            }
        }

        // 2. Check if pasted content is a URL
        const text = clipboardData.getData('text');
        if (text) {
            let cleanText = text.trim();
            // Simple check to see if text looks like a web link / domain
            const urlPattern = /^(https?:\/\/|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/[^\s]*)?$/i;
            
            if (urlPattern.test(cleanText)) {
                e.preventDefault();

                // Ensure URL has a protocol for the href attribute
                let href = cleanText;
                if (!/^https?:\/\//i.test(href)) {
                    href = 'https://' + href;
                }

                // Create clickable link element
                const a = document.createElement('a');
                a.href = href;
                a.textContent = cleanText;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';

                let selection = window.getSelection();
                if (selection.rangeCount) {
                    let range = selection.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(a);

                    // Move cursor right after the link
                    range.setStartAfter(a);
                    range.setEndAfter(a);
                    selection.removeAllRanges();
                    selection.addRange(range);
                } else {
                    pad.appendChild(a);
                }

                localStorage.setItem(storageKey, pad.innerHTML);
                return;
            }
        }
    });
}

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
    event.target.value = ''; // Reset file input
}

function insertImageBlob(pad, blob, storageKey) {
    pad.focus();
    let reader = new FileReader();
    reader.onload = function(event) {
        let base64Image = event.target.result;
        let img = document.createElement('img');
        img.src = base64Image;

        let selection = window.getSelection();
        if (selection.rangeCount) {
            let range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
        } else {
            pad.appendChild(img);
        }
        localStorage.setItem(storageKey, pad.innerHTML);
    };
    reader.readAsDataURL(blob);
}

function addCheckbox(id) {
    const pad = document.getElementById(id);
    pad.focus();
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    
    const wrapper = document.createElement('div');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    
    const textSpan = document.createElement('span');
    textSpan.textContent = 'New task';
    
    wrapper.appendChild(checkbox);
    wrapper.appendChild(document.createTextNode(' '));
    wrapper.appendChild(textSpan);
    wrapper.appendChild(document.createElement('br'));
    
    range.deleteContents();
    range.insertNode(wrapper);
    
    const newRange = document.createRange();
    newRange.selectNodeContents(textSpan);
    selection.removeAllRanges();
    selection.addRange(newRange);
    
    const storageKey = id === 'scratchpad' ? 'myScratchpad' : 'myScratchpad2';
    localStorage.setItem(storageKey, pad.innerHTML);
}

function addList(id, command) {
    const pad = document.getElementById(id);
    pad.focus();
    document.execCommand(command, false, null);
    const storageKey = id === 'scratchpad' ? 'myScratchpad' : 'myScratchpad2';
    localStorage.setItem(storageKey, pad.innerHTML);
}

function addLink(id) {
    const pad = document.getElementById(id);
    pad.focus();
    
    const selection = window.getSelection();
    let selectedText = selection.toString();
    
    let url = prompt("Enter the URL (e.g., https://example.com):");
    if (!url) return;
    
    // Automatically add https:// if they forgot it
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    if (selectedText.length > 0) {
        // If text was highlighted, convert it into a link
        document.execCommand('createLink', false, url);
    } else {
        // If nothing was highlighted, ask for display text
        let linkText = prompt("Enter the text to display for this link:", url);
        if (!linkText) linkText = url;
        
        const range = selection.rangeCount ? selection.getRangeAt(0) : null;
        if (range) {
            const a = document.createElement('a');
            a.href = url;
            a.textContent = linkText;
            a.target = '_blank'; // Opens link in a new tab safely
            
            range.deleteContents();
            range.insertNode(a);
        }
    }
    
    const storageKey = id === 'scratchpad' ? 'myScratchpad' : 'myScratchpad2';
    localStorage.setItem(storageKey, pad.innerHTML);
}