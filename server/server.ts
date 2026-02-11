import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({ logger: true });

// Register WebSocket support
fastify.register(fastifyWebsocket);

// Serve static files (HTML/CSS)
fastify.register(fastifyStatic, {
    root: join(__dirname, '../client'),
    prefix: '/',
});

// --- CRITICAL: Health Check for Koyeb ---
// This tells Koyeb "I am alive" instantly, even if Puppeteer is still loading
fastify.get('/health', async (request, reply) => {
    return { status: 'ok', browser: browser ? 'ready' : 'loading' };
});

// Store active pages
const pages: { [id: string]: any } = {};
let browser: any = null;

async function launchBrowser() {
    try {
        console.log("🚀 Launching Chrome Engine...");
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
                '--no-zygote'
            ]
        });
        console.log("✅ Chrome Engine Ready!");
    } catch (err) {
        console.error("❌ Chrome Failed to Launch:", err);
    }
}

// WebSocket Logic
fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
        const socket = connection.socket || connection;
        console.log('⚡ Client Connected');

        if (!browser) {
            socket.send(JSON.stringify({ type: 'error', message: 'Browser is still warming up...' }));
            return;
        }

        socket.on('message', async (message: any) => {
            try {
                const data = JSON.parse(message.toString());

                // Initialize New Tab
                if (data.type === 'init' || data.type === 'new-tab') {
                    if (!browser) return;
                    
                    const page = await browser.newPage();
                    await page.setViewport({ width: 1280, height: 720 });
                    await page.goto('https://google.com');
                    
                    const id = data.id || 'tab-1';
                    pages[id] = page;

                    // Stream Screenshots
                    const streamInterval = setInterval(async () => {
                        if (page.isClosed()) {
                            clearInterval(streamInterval);
                            return;
                        }
                        try {
                            const screenshot = await page.screenshot({ 
                                type: 'jpeg', 
                                quality: 50,
                                optimizeForSpeed: true 
                            });
                            socket.send(screenshot);
                        } catch (e) {}
                    }, 150); // Faster FPS
                }

                // Handle Navigation
                if (data.type === 'navigate') {
                    const page = pages['tab-1'];
                    if (page) await page.goto(data.url);
                }

                // Handle Input
                if (data.type === 'click') {
                    const page = pages['tab-1'];
                    if (page) await page.mouse.click(data.x, data.y);
                }
                
                if (data.type === 'type') {
                    const page = pages['tab-1'];
                    if (page) await page.keyboard.press(data.key);
                }

            } catch (err) {
                console.error("Socket Error:", err);
            }
        });
    });
});

// Start Server
const start = async () => {
    try {
        const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
        
        // Listen on 0.0.0.0 is MANDATORY for Docker
        await fastify.listen({ port: port, host: '0.0.0.0' });
        console.log(`🚀 Server listening on port ${port}`);

        // Launch browser in background so it doesn't block server start
        launchBrowser();

    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();