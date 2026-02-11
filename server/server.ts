import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import puppeteer from 'puppeteer';
import path from 'path';

const fastify = Fastify({ logger: false });

async function start() {
    console.log("🚀 Nebula Boot Sequence Started...");

    try {
        await fastify.register(fastifyWebsocket);
        await fastify.register(fastifyStatic, {
            root: path.join(__dirname, '../client'),
            prefix: '/',
        });

        console.log("📦 Plugins Registered. Launching Browser...");

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        console.log("🌐 Browser Engine Ready.");

        fastify.register(async (instance) => {
            // "connection" in @fastify/websocket contains the socket
            instance.get('/ws', { websocket: true }, async (connection) => {
                console.log("📡 New WebSocket connection established!");
                
                // Compatibility fix: define the raw socket
                const socket = connection.socket || connection; 

                const page = await browser.newPage();
                await page.setViewport({ width: 1280, height: 720 });
                await page.goto('https://www.google.com');

                const streamInterval = setInterval(async () => {
                    // Check if socket exists and is open (readyState 1)
                    if (socket && socket.readyState === 1) {
                        try {
                            const screenshot = await page.screenshot({ type: 'jpeg', quality: 60 });
                            socket.send(screenshot);
                        } catch (e) { /* Navigation overlap */ }
                    }
                }, 200);

                socket.on('message', async (message: any) => {
                    try {
                        const data = JSON.parse(message.toString());
                        if (data.type === 'navigate') await page.goto(data.url, { waitUntil: 'domcontentloaded' });
                        if (data.type === 'click') await page.mouse.click(data.x, data.y);
                        if (data.type === 'type') await page.keyboard.press(data.key);
                    } catch (err) { console.error("Input error:", err); }
                });

                socket.on('close', async () => {
                    console.log("🔌 Connection closing...");
                    clearInterval(streamInterval);
                    await page.close().catch(() => {});
                });
            });
        });

        const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
        await fastify.listen({ port: port, host: '0.0.0.0' });  
        console.log("✅ SERVER LISTENING ON PORT 3000");

    } catch (err) {
        console.error("❌ SERVER FAILED TO START:", err);
        process.exit(1);
    }
}

start();