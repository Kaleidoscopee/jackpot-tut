
if (!window.ocrExtensionLoaded) {
    window.ocrExtensionLoaded = true;

    chrome.runtime.onMessage.addListener((req, sen, res) => {
        if (req.action === "START_SELECTION") {
            createOverlay();
            res({ status: "started" });
            return true;
        }
    });

    function createOverlay() {
        if (document.getElementById('ocr-overlay')) return;

        const o = document.createElement('div');
        o.id = 'ocr-overlay';
        document.body.appendChild(o);

        let sx, sy, drag = false;
        const sb = document.createElement('div');
        sb.id = 'ocr-selection-box';
        o.appendChild(sb);

        o.addEventListener('mousedown', e => {
            drag = true;
            sx = e.clientX;
            sy = e.clientY;
            sb.style.cssText = `left:${sx}px;top:${sy}px;width:0;height:0;display:block`;
        });

        o.addEventListener('mousemove', e => {
            if (!drag) return;
            const w = Math.abs(e.clientX - sx),
                h = Math.abs(e.clientY - sy);
            sb.style.cssText = `left:${Math.min(e.clientX, sx)}px;top:${Math.min(e.clientY, sy)}px;width:${w}px;height:${h}px;display:block`;
        });

        o.addEventListener('mouseup', () => {
            drag = false;
            const r = sb.getBoundingClientRect();
            document.body.removeChild(o);

            if (r.width > 10 && r.height > 10) {
                showLoading();
                chrome.runtime.sendMessage({
                    action: "CAPTURE_REGION",
                    coordinates: {
                        x: r.left,
                        y: r.top,
                        width: r.width,
                        height: r.height,
                        pixelRatio: window.devicePixelRatio
                    }
                }, (resp) => {
                    hideLoading();
                    if (chrome.runtime.lastError) alert("Error: " + chrome.runtime.lastError.message);
                    else if (resp && resp.error) alert("OCR Error: " + resp.error);
                    else if (resp && resp.text) showOCRResult(resp.text);
                });
            }
        });
    }

    function showLoading() {
        const l = document.createElement('div');
        l.id = 'ocr-loading';
        l.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:20px;border-radius:10px;z-index:1000000;font-family:sans-serif;';
        l.textContent = 'Processing OCR...';
        document.body.appendChild(l);
    }

    function hideLoading() {
        const l = document.getElementById('ocr-loading');
        if (l) l.remove();
    }

    function makeDraggable(el, handle) {
        let d = false, px = 0, py = 0, cx = 0, cy = 0;
        handle.style.cursor = 'move';
        handle.addEventListener('mousedown', e => {
            if (e.target.tagName === 'BUTTON') return;
            d = true;
            px = e.clientX;
            py = e.clientY;
        });
        document.addEventListener('mousemove', e => {
            if (!d) return;
            e.preventDefault();
            cx = px - e.clientX;
            cy = py - e.clientY;
            px = e.clientX;
            py = e.clientY;
            el.style.top = (el.offsetTop - cy) + 'px';
            el.style.left = (el.offsetLeft - cx) + 'px';
        });
        document.addEventListener('mouseup', () => d = false);
    }

    function makeResizable(el) {
        const resizer = document.createElement('div');
        resizer.style.cssText = 'width:16px!important;height:16px!important;background:linear-gradient(45deg, rgba(255,255,255,0.4) 50%, transparent 50%)!important;position:absolute!important;left:0!important;bottom:0!important;cursor:sw-resize!important;z-index:100!important;border-radius:0 0 0 12px!important;';
        el.appendChild(resizer);

        let startX, startY, startW, startH, startLeft;

        resizer.addEventListener('mousedown', initResize, false);

        function initResize(e) {
            startX = e.clientX;
            startY = e.clientY;
            startW = parseInt(document.defaultView.getComputedStyle(el).width, 10);
            startH = parseInt(document.defaultView.getComputedStyle(el).height, 10);
            startLeft = el.getBoundingClientRect().left;

            window.addEventListener('mousemove', Resize, false);
            window.addEventListener('mouseup', stopResize, false);
            e.preventDefault();
        }
        function Resize(e) {
            const deltaX = startX - e.clientX;
            const newW = startW + deltaX;
            const newH = startH + (e.clientY - startY);

            if (newW > 280) {
                el.style.width = newW + 'px';
                el.style.left = (startLeft - deltaX) + 'px';
            }
            if (newH > 200) {
                el.style.height = newH + 'px';
            }
        }
        function stopResize(e) {
            window.removeEventListener('mousemove', Resize, false);
            window.removeEventListener('mouseup', stopResize, false);
        }
    }

    function showOCRResult(txt) {
        const panel = document.createElement('div');
        // Added flex layout to panel and min-height
        panel.style.cssText = 'position:fixed!important;top:20px!important;right:20px!important;width:340px!important;height:300px!important;min-width:280px!important;min-height:200px!important;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%)!important;border-radius:12px!important;padding:0!important;box-shadow:0 8px 32px rgba(0,0,0,0.3)!important;z-index:2147483647!important;color:white!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;margin:0!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;';

        panel.innerHTML = `
            <div class="panel-header" style="display:flex!important;justify-content:space-between!important;align-items:center!important;padding:14px 20px!important;border-bottom:1px solid rgba(255,255,255,0.2)!important;flex-shrink:0!important">
                <h3 style="margin:0!important;font-size:16px!important;font-weight:600!important;color:white!important;pointer-events:none!important">OCR Result</h3>
                <div style="display:flex!important;gap:6px!important">
                    <button class="close-btn" style="width:28px!important;height:28px!important;border-radius:6px!important;background:rgba(255,255,255,0.1)!important;border:none!important;color:white!important;font-size:18px!important;cursor:pointer!important;line-height:1!important;flex-shrink:0!important">×</button>
                </div>
            </div>
            <div class="panel-content" style="padding:20px!important;padding-bottom:24px!important;flex:1!important;display:flex!important;flex-direction:column!important;overflow:hidden!important">
                <div style="background:rgba(0,0,0,0.2)!important;border-radius:8px!important;padding:14px!important;margin-bottom:16px!important;flex:1!important;display:flex!important;flex-direction:column!important">
                    <textarea id="ocr-text-area" style="width:100%!important;height:100%!important;background:transparent!important;border:none!important;color:white!important;font-size:14px!important;line-height:1.6!important;resize:none!important;font-family:inherit!important;outline:none!important;flex:1!important">${txt}</textarea>
                </div>
                <div style="display:flex!important;gap:10px!important;justify-content:flex-end!important;flex-shrink:0!important">
                    <button class="note-btn" style="width:130px!important;padding:12px 16px!important;border:none!important;border-radius:8px!important;font-size:13px!important;font-weight:600!important;cursor:pointer!important;background:rgba(255,255,255,0.15)!important;color:white!important;white-space:nowrap!important">📝 Save Note</button>
                    <button class="flashcard-btn" style="width:130px!important;padding:12px 16px!important;border:none!important;border-radius:8px!important;font-size:13px!important;font-weight:600!important;cursor:pointer!important;background:white!important;color:#667eea!important;white-space:nowrap!important">➕ Flashcard</button>
                    <button class="copy-btn" style="width:110px!important;padding:12px 16px!important;border:none!important;border-radius:8px!important;font-size:13px!important;font-weight:600!important;cursor:pointer!important;background:rgba(255,255,255,0.2)!important;color:white!important;white-space:nowrap!important">📋 Copy</button>
                </div>
            </div>`;

        document.body.appendChild(panel);
        makeDraggable(panel, panel.querySelector('.panel-header'));
        makeResizable(panel);

        const close = () => panel.remove();
        panel.querySelector('.close-btn').addEventListener('click', close);

        panel.querySelector('.copy-btn').addEventListener('click', () => {
            const currentText = document.getElementById('ocr-text-area').value;
            navigator.clipboard.writeText(currentText).then(() => {
                const btn = panel.querySelector('.copy-btn');
                const orig = btn.innerHTML;
                btn.innerHTML = '✓ Copied!';
                setTimeout(() => btn.innerHTML = orig, 1500);
            });
        });

        panel.querySelector('.note-btn').addEventListener('click', () => {
            const currentText = document.getElementById('ocr-text-area').value;
            if (!currentText.trim()) return;

            const btn = panel.querySelector('.note-btn');
            const orig = btn.textContent;
            btn.textContent = 'Saving...';
            btn.disabled = true;

            chrome.runtime.sendMessage({
                action: "SAVE_NOTE_TO_SUPABASE",
                content: currentText,
                sourceUrl: window.location.href
            }, (response) => {
                btn.textContent = orig;
                btn.disabled = false;

                if (chrome.runtime.lastError) {
                    alert("Error: " + chrome.runtime.lastError.message);
                } else if (response && response.error) {
                    alert("Save Error: " + response.error);
                } else {
                    const suc = document.createElement('div');
                    suc.style.cssText = 'position:fixed!important;top:20px!important;right:20px!important;background:#10b981!important;color:white!important;padding:12px 20px!important;border-radius:8px!important;font-family:system-ui!important;z-index:2147483647!important;box-shadow:0 4px 12px rgba(0,0,0,0.3)!important;font-size:14px!important';
                    suc.textContent = '✓ Note saved to Inbox!';
                    document.body.appendChild(suc);
                    setTimeout(() => suc.remove(), 2000);
                }
            });
        });

        panel.querySelector('.flashcard-btn').addEventListener('click', () => {
            const currentText = document.getElementById('ocr-text-area').value;
            panel.remove();
            showFlashcardForm(currentText);
        });
    }

    function showFlashcardForm(txt) {
        // Fetch decks first
        const loadingPanel = document.createElement('div');
        loadingPanel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:20px;border-radius:10px;z-index:1000000;font-family:sans-serif;';
        loadingPanel.textContent = 'Loading Decks...';
        document.body.appendChild(loadingPanel);

        chrome.runtime.sendMessage({ action: "GET_DECKS" }, (response) => {
            loadingPanel.remove();
            if (chrome.runtime.lastError || (response && response.error)) {
                alert("Error loading decks: " + (chrome.runtime.lastError?.message || response?.error));
                return;
            }

            const decks = response.decks || [];
            renderForm(txt, decks);
        });
    }

    function renderForm(txt, decks) {
        const panel = document.createElement('div');
        panel.style.cssText = 'position:fixed!important;top:20px!important;right:20px!important;width:340px!important;min-width:280px!important;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%)!important;border-radius:12px!important;padding:0!important;box-shadow:0 8px 32px rgba(0,0,0,0.3)!important;z-index:2147483647!important;color:white!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;margin:0!important;overflow:hidden!important';

        let deckOptions = '';
        if (decks.length === 0) {
            deckOptions = '<option value="">No decks found (Create one on web)</option>';
        } else {
            decks.forEach(d => {
                deckOptions += `<option value="${d.id}">${d.name}</option>`;
            });
        }

        panel.innerHTML = `
            <div class="panel-header" style="display:flex!important;justify-content:space-between!important;align-items:center!important;padding:18px 20px!important;border-bottom:1px solid rgba(255,255,255,0.2)!important">
                <h3 style="margin:0!important;font-size:16px!important;font-weight:600!important;color:white!important;pointer-events:none!important">Create Flashcard</h3>
                <div style="display:flex!important;gap:6px!important">
                    <button class="close-btn" style="width:28px!important;height:28px!important;border-radius:6px!important;background:rgba(255,255,255,0.1)!important;border:none!important;color:white!important;font-size:18px!important;cursor:pointer!important;line-height:1!important;flex-shrink:0!important">×</button>
                </div>
            </div>
            <div class="panel-content" style="padding:20px!important;padding-bottom:24px!important">
                <div style="margin-bottom:14px!important">
                    <label style="display:block!important;margin-bottom:8px!important;font-size:13px!important;font-weight:500!important;color:white!important">Deck</label>
                    <select id="fc-deck" style="width:100%!important;padding:12px!important;border:2px solid rgba(255,255,255,0.2)!important;border-radius:8px!important;background:rgba(255,255,255,0.1)!important;color:white!important;font-size:13px!important;box-sizing:border-box!important;appearance:none!important">
                        ${deckOptions}
                    </select>
                </div>
                <div style="margin-bottom:14px!important">
                    <label style="display:block!important;margin-bottom:8px!important;font-size:13px!important;font-weight:500!important;color:white!important">Front (Question)</label>
                    <input type="text" id="fc-front" placeholder="What does this mean?" style="width:100%!important;padding:12px!important;border:2px solid rgba(255,255,255,0.2)!important;border-radius:8px!important;background:rgba(255,255,255,0.1)!important;color:white!important;font-size:13px!important;box-sizing:border-box!important">
                </div>
                <div style="margin-bottom:16px!important">
                    <label style="display:block!important;margin-bottom:8px!important;font-size:13px!important;font-weight:500!important;color:white!important">Back (Answer)</label>
                    <textarea id="fc-back" rows="3" style="width:100%!important;padding:12px!important;border:2px solid rgba(255,255,255,0.2)!important;border-radius:8px!important;background:rgba(255,255,255,0.1)!important;color:white!important;font-size:13px!important;resize:vertical!important;box-sizing:border-box!important">${txt}</textarea>
                </div>
                <div style="display:flex!important;gap:10px!important;justify-content:flex-end!important">
                    <button class="cancel-btn" style="width:100px!important;padding:12px!important;border:2px solid rgba(255,255,255,0.3)!important;border-radius:8px!important;font-size:13px!important;font-weight:600!important;cursor:pointer!important;background:rgba(255,255,255,0.1)!important;color:white!important;white-space:nowrap!important">← Back</button>
                    <button class="save-btn" style="width:100px!important;padding:12px!important;border:none!important;border-radius:8px!important;font-size:13px!important;font-weight:600!important;cursor:pointer!important;background:white!important;color:#667eea!important;white-space:nowrap!important">Save</button>
                </div>
            </div>`;

        document.body.appendChild(panel);
        makeDraggable(panel, panel.querySelector('.panel-header'));
        setTimeout(() => document.getElementById('fc-front').focus(), 100);

        const close = () => panel.remove();
        const back = () => { panel.remove(); showOCRResult(txt); };

        panel.querySelector('.close-btn').addEventListener('click', close);
        panel.querySelector('.cancel-btn').addEventListener('click', back);

        panel.querySelector('.save-btn').addEventListener('click', () => {
            const deckId = document.getElementById('fc-deck').value;
            const f = document.getElementById('fc-front').value.trim();
            const b = document.getElementById('fc-back').value.trim();

            if (!deckId) {
                alert('Please select a deck');
                return;
            }
            if (!f || !b) {
                alert('Fill both fields');
                return;
            }

            const btn = panel.querySelector('.save-btn');
            const originalText = btn.textContent;
            btn.textContent = 'Saving...';
            btn.disabled = true;

            chrome.runtime.sendMessage({
                action: "SAVE_CARD_TO_SUPABASE",
                deckId: deckId,
                front: f,
                back: b
            }, (response) => {
                btn.textContent = originalText;
                btn.disabled = false;

                if (chrome.runtime.lastError) {
                    alert("Error: " + chrome.runtime.lastError.message);
                } else if (response && response.error) {
                    alert("Save Error: " + response.error);
                } else {
                    close();
                    const suc = document.createElement('div');
                    suc.style.cssText = 'position:fixed!important;top:20px!important;right:20px!important;background:#10b981!important;color:white!important;padding:12px 20px!important;border-radius:8px!important;font-family:system-ui!important;z-index:2147483647!important;box-shadow:0 4px 12px rgba(0,0,0,0.3)!important;font-size:14px!important';
                    suc.textContent = '✓ Flashcard saved!';
                    document.body.appendChild(suc);
                    setTimeout(() => suc.remove(), 2000);
                }
            });
        });
    }
}
