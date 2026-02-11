import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// --- FIX FOR ESM (__dirname definition) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// ------------------------------------------

const fastify = Fastify({ logger: true });

fastify.register(fastifyWebsocket);

// Serve static files (HTML/CSS/JS) from the client folder
// We use join(__dirname, '../client') to step out of 'server' and into 'client'
fastify.register(fastifyStatic, {
    root: join(__dirname, '../client'),
    prefix: '/', 
});

// Store active browser pages
const pages: { [id: string]: any } = {};
let browser: any;

async function start() {
    try {
        console.log("🚀 Nebula Boot Sequence Started...");
        
        // Launch Puppeteer with Koyeb-compatible flags
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Critical for Docker/Koyeb
                '--disable-gpu',
                '--single-process',
                '--no-zygote'
            ]
        });

        console.log("📦 Plugins Registered. Launching Browser...");

        fastify.register(async function (fastify) {
            fastify.get('/ws', { websocket: true }, (connection, req) => {
                const socket = connection.socket || connection; // Handle different fastify versions
                console.log('Client connected to Nebula Stream');

                socket.on('message', async (message: Buffer) => {
                    const data = JSON.parse(message.toString());

                    if (data.type === 'init' || data.type === 'new-tab') {
                        const page = await browser.newPage();
                        await page.setViewport({ width: 1280, height: 720 });
                        await page.goto('https://google.com');
                        
                        const id = data.id || 'tab-1';
                        pages[id] = page;
                        
                        // Stream setup (200ms interval = 5 FPS)
                        const streamInterval = setInterval(async () => {
                            try {
                                if (page.isClosed()) {
                                    clearInterval(streamInterval);
                                    return;
                                }
                                const screenshot = await page.screenshot({ 
                                    type: 'jpeg', 
                                    quality: 50,
                                    optimizeForSpeed: true 
                                });
                                socket.send(screenshot);
                            } catch (e) {
                                clearInterval(streamInterval);
                            }
                        }, 200);

                    } else if (data.type === 'navigate') {
                        const page = pages['tab-1']; // Defaulting to tab-1 for now if no ID sent
                        if (page) await page.goto(data.url);

                    } else if (data.type === 'click') {
                        const page = pages['tab-1'];
                        if (page) await page.mouse.click(data.x, data.y);

                    } else if (data.type === 'scroll') {
                        const page = pages['tab-1'];
                        if (page) await page.mouse.wheel({ deltaY: data.deltaY });

                    } else if (data.type === 'type') {
                        const page = pages['tab-1']; 
                        if (page) {
                            const specialKeys = ['Enter', 'Backspace', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
                            if (specialKeys.includes(data.key)) {
                                await page.keyboard.press(data.key);
                            } else {
                                await page.keyboard.type(data.key);
                            }
                        }
                    }
                });
            });
        });

        // Use the PORT environment variable provided by Koyeb
        const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
        await fastify.listen({ port, host: '0.0.0.0' });
        
        console.log(`🚀 Server listening on port ${port}`);

    } catch (err) {
        console.error("❌ SERVER FAILED TO START:", err);
        process.exit(1);
    }
}

start();