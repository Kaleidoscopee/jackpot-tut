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

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: chromeStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const captureBtn = document.getElementById('capture-btn');
    const container = document.getElementById('flashcards-container');
    const authContainer = document.getElementById('auth-container') || document.createElement('div');
    const mainContainer = document.getElementById('main-container') || document.createElement('div');

    authContainer.id = 'auth-container';
    mainContainer.id = 'main-container';
    mainContainer.style.display = 'none';

    if (!document.getElementById('auth-container')) document.body.appendChild(authContainer);
    if (!document.getElementById('main-container')) document.body.appendChild(mainContainer);

    // Move existing elements to main container if they are not already there
    if (captureBtn.parentElement !== mainContainer) mainContainer.appendChild(captureBtn);
    if (container.parentElement !== mainContainer) mainContainer.appendChild(container);

    // Check Session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        renderLogin();
    } else {
        renderMain(session);
    }

    function renderLogin() {
        authContainer.innerHTML = `
      <h3>Login</h3>
      <input type="email" id="email" placeholder="Email" style="width: 100%; margin-bottom: 5px; padding: 5px;">
      <input type="password" id="password" placeholder="Password" style="width: 100%; margin-bottom: 10px; padding: 5px;">
      <button id="login-btn">Login</button>
      <p id="login-error" style="color: red; font-size: 12px;"></p>
    `;

        document.getElementById('login-btn').addEventListener('click', async () => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorEl = document.getElementById('login-error');
            errorEl.textContent = 'Logging in...';

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                errorEl.textContent = error.message;
            } else {
                authContainer.style.display = 'none';
                renderMain(data.session);
            }
        });
    }

    async function renderMain(session) {
        mainContainer.style.display = 'block';

        captureBtn.onclick = async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) return;

            // Inject scripts if needed
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content/content.js']
                });
                await chrome.scripting.insertCSS({
                    target: { tabId: tab.id },
                    files: ['content/overlay.css']
                });
            } catch (e) {
                console.log('Script already injected or cannot inject', e);
            }

            // Send message to start selection
            chrome.tabs.sendMessage(tab.id, { action: 'START_SELECTION' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                    alert("Please refresh the page and try again.");
                } else {
                    window.close(); // Close popup to let user select
                }
            });
        };
    }
});
