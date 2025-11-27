importScripts('lib/supabase.js');

const SUPABASE_URL = 'https://wvddrvmbxllsjtpmnbvk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2ZGRydm1ieGxsc2p0cG1uYnZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTUxNzAsImV4cCI6MjA3OTE3MTE3MH0.Nlq7gBmyccUR5k0KqhFRflv_dHxiSu1dGLfotN9NH4A';

const chromeStorageAdapter = {
    getItem: (key) => {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key]);
            });
        });
    },
    setItem: (key, value) => {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, () => {
                resolve();
            });
        });
    },
    removeItem: (key) => {
        return new Promise((resolve) => {
            chrome.storage.local.remove([key], () => {
                resolve();
            });
        });
    },
};

const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: chromeStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
    }
});

console.log("Background script loaded");

let offscreenDocumentCreated = false;

async function ensureOffscreenDocument() {
    if (offscreenDocumentCreated) return;

    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) {
        offscreenDocumentCreated = true;
        return;
    }

    await chrome.offscreen.createDocument({
        url: 'offscreen/offscreen.html',
        reasons: ['WORKERS'],
        justification: 'Run Tesseract.js OCR processing with Web Workers'
    });

    offscreenDocumentCreated = true;
    console.log("Offscreen document created");
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "CAPTURE_REGION") {
        console.log("Capture region requested", request.coordinates);

        chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                sendResponse({ error: chrome.runtime.lastError.message });
                return;
            }

            cropImage(dataUrl, request.coordinates)
                .then(croppedDataUrl => {
                    console.log("Image cropped, ensuring offscreen document...");
                    return ensureOffscreenDocument().then(() => croppedDataUrl);
                })
                .then(croppedDataUrl => {
                    console.log("Sending to offscreen document for OCR...");

                    chrome.runtime.sendMessage({
                        action: "DO_OCR",
                        imageUrl: croppedDataUrl
                    }, async (ocrResponse) => {
                        console.log("Received response from offscreen:", ocrResponse);

                        if (chrome.runtime.lastError) {
                            console.error("Message error:", chrome.runtime.lastError);
                            sendResponse({ error: chrome.runtime.lastError.message });
                        } else if (!ocrResponse) {
                            console.error("No response from offscreen document");
                            sendResponse({ error: "No response from OCR processor" });
                        } else if (ocrResponse.error) {
                            console.error("OCR Failed:", ocrResponse.error);
                            sendResponse({ error: "OCR Failed: " + ocrResponse.error });
                        } else {
                            console.log("OCR Success:", ocrResponse.text);
                            sendResponse({ status: "success", text: ocrResponse.text });
                        }
                    });
                })
                .catch(err => {
                    console.error("Processing failed:", err);
                    sendResponse({ error: "Processing failed: " + err.message });
                });
        });

        return true;
    } else if (request.action === "GET_DECKS") {
        (async () => {
            const { data: decks, error } = await supabase
                .from('decks')
                .select('id, name')
                .order('created_at', { ascending: false });

            if (error) {
                sendResponse({ error: error.message });
            } else {
                sendResponse({ decks });
            }
        })();
        return true;
    } else if (request.action === "SAVE_CARD_TO_SUPABASE") {
        (async () => {
            try {
                const { deckId, front, back } = request;
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    sendResponse({ error: "Not logged in" });
                    return;
                }

                if (!deckId) {
                    sendResponse({ error: "No deck selected!" });
                    return;
                }

                const { error } = await supabase
                    .from('flashcards')
                    .insert({
                        deck_id: deckId,
                        front: front,
                        back: back,
                        user_id: session.user.id
                    });

                if (error) {
                    console.error("Supabase Save Error:", error);
                    sendResponse({ error: "Save failed: " + error.message });
                } else {
                    sendResponse({ status: "success" });
                }
            } catch (err) {
                console.error("Save Error:", err);
                sendResponse({ error: "Save failed: " + err.message });
            }
        })();
        return true;
    } else if (request.action === "SAVE_NOTE_TO_SUPABASE") {
        (async () => {
            try {
                const { content, sourceUrl } = request;
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    sendResponse({ error: "Not logged in" });
                    return;
                }

                const { error } = await supabase
                    .from('notes')
                    .insert({
                        content: content,
                        source_url: sourceUrl,
                        user_id: session.user.id
                    });

                if (error) {
                    console.error("Supabase Save Note Error:", error);
                    sendResponse({ error: "Save failed: " + error.message });
                } else {
                    sendResponse({ status: "success" });
                }
            } catch (err) {
                console.error("Save Note Error:", err);
                sendResponse({ error: "Save failed: " + err.message });
            }
        })();
        return true;
    }
});

async function cropImage(dataUrl, coords) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const bitmap = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(coords.width, coords.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
        bitmap,
        coords.x * coords.pixelRatio,
        coords.y * coords.pixelRatio,
        coords.width * coords.pixelRatio,
        coords.height * coords.pixelRatio,
        0, 0,
        coords.width, coords.height
    );

    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(croppedBlob);
    });
}
