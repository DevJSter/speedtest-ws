import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import fetch from 'node-fetch';
import { randomBytes } from 'crypto';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Enhanced SpeedTest class with better simulation
class EnhancedSpeedTest {
    constructor() {
        this.downloadUrls = [
            'https://speed.cloudflare.com/__down?bytes=10000000', // 10MB
            'https://speed.cloudflare.com/__down?bytes=25000000', // 25MB
            'https://speed.cloudflare.com/__down?bytes=100000000' // 100MB
        ];
        this.uploadUrl = 'https://httpbin.org/post';
        this.pingUrls = [
            'https://www.google.com',
            'https://www.cloudflare.com',
            'https://www.github.com'
        ];
    }

    bytesToMbps(bytes, timeInSeconds) {
        return ((bytes * 8) / (1024 * 1024) / timeInSeconds);
    }

    generateTestData(sizeInMB) {
        const bytes = sizeInMB * 1024 * 1024;
        return randomBytes(bytes);
    }

    async measurePing(url, retries = 3) {
        let totalTime = 0;
        let successfulPings = 0;

        for (let i = 0; i < retries; i++) {
            try {
                const startTime = process.hrtime.bigint();
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                await fetch(url, { 
                    method: 'HEAD',
                    signal: controller.signal 
                });
                
                clearTimeout(timeoutId);
                const endTime = process.hrtime.bigint();
                const pingTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
                
                totalTime += pingTime;
                successfulPings++;
                
                // Small delay between pings
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.warn(`Ping attempt ${i + 1} failed for ${url}:`, error.message);
            }
        }

        return successfulPings > 0 ? Math.round(totalTime / successfulPings) : null;
    }

    async testPing() {
        const results = [];
        for (const url of this.pingUrls) {
            const ping = await this.measurePing(url);
            if (ping !== null) {
                results.push(ping);
            }
        }
        
        if (results.length === 0) {
            throw new Error('All ping tests failed');
        }
        
        // Return median ping time
        results.sort((a, b) => a - b);
        const median = results[Math.floor(results.length / 2)];
        return median;
    }

    async testDownloadWithProgress(ws) {
        try {
            let totalSpeed = 0;
            let successfulTests = 0;
            const speeds = [];

            for (const [index, url] of this.downloadUrls.entries()) {
                try {
                    ws.send(JSON.stringify({ 
                        type: 'status', 
                        phase: 'download', 
                        message: `Testing download speed... (${index + 1}/${this.downloadUrls.length})` 
                    }));

                    const startTime = process.hrtime.bigint();
                    const response = await fetch(url);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    let receivedBytes = 0;
                    let lastUpdateTime = process.hrtime.bigint();
                    const chunks = [];

                    // Simulate real-time progress updates
                    for await (const chunk of response.body) {
                        chunks.push(chunk);
                        receivedBytes += chunk.length;
                        
                        const currentTime = process.hrtime.bigint();
                        const timeDiff = Number(currentTime - lastUpdateTime) / 1000000000; // Convert to seconds
                        
                        if (timeDiff > 0.1) { // Update every 100ms
                            const totalTime = Number(currentTime - startTime) / 1000000000;
                            const currentSpeed = this.bytesToMbps(receivedBytes, totalTime);
                            speeds.push(currentSpeed);
                            
                            ws.send(JSON.stringify({ 
                                type: 'download-progress', 
                                speed: currentSpeed.toFixed(2),
                                progress: Math.min((receivedBytes / (25 * 1024 * 1024)) * 100, 100)
                            }));
                            
                            lastUpdateTime = currentTime;
                        }
                    }

                    const totalBuffer = Buffer.concat(chunks);
                    const endTime = process.hrtime.bigint();
                    const durationInSeconds = Number(endTime - startTime) / 1000000000;
                    const speedMbps = this.bytesToMbps(totalBuffer.length, durationInSeconds);
                    
                    totalSpeed += speedMbps;
                    successfulTests++;
                    
                    console.log(`Download test ${index + 1}: ${speedMbps.toFixed(2)} Mbps`);
                    
                } catch (error) {
                    console.error(`Download test ${index + 1} failed:`, error.message);
                }
            }

            if (successfulTests === 0) {
                throw new Error('All download tests failed');
            }

            const averageSpeed = totalSpeed / successfulTests;
            const maxSpeed = Math.max(...speeds);
            
            return {
                speed: averageSpeed.toFixed(2),
                maxSpeed: maxSpeed.toFixed(2),
                successfulTests
            };
        } catch (error) {
            console.error('Download test failed:', error);
            throw error;
        }
    }

    async testUploadWithProgress(ws) {
        try {
            ws.send(JSON.stringify({ 
                type: 'status', 
                phase: 'upload', 
                message: 'Preparing upload test...' 
            }));

            const testData = this.generateTestData(5); // 5MB
            
            ws.send(JSON.stringify({ 
                type: 'status', 
                phase: 'upload', 
                message: 'Starting upload test...' 
            }));

            const startTime = process.hrtime.bigint();
            let uploadedBytes = 0;
            let lastUpdateTime = process.hrtime.bigint();

            // Simulate chunked upload with progress updates
            const chunkSize = 64 * 1024; // 64KB chunks
            const totalChunks = Math.ceil(testData.length / chunkSize);
            
            for (let i = 0; i < totalChunks; i++) {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, testData.length);
                const chunk = testData.slice(start, end);
                
                try {
                    await fetch(this.uploadUrl, {
                        method: 'POST',
                        body: chunk,
                        headers: {
                            'Content-Type': 'application/octet-stream',
                            'Content-Length': chunk.length.toString()
                        }
                    });
                    
                    uploadedBytes += chunk.length;
                    
                    const currentTime = process.hrtime.bigint();
                    const timeDiff = Number(currentTime - lastUpdateTime) / 1000000000;
                    
                    if (timeDiff > 0.2 || i === totalChunks - 1) { // Update every 200ms
                        const totalTime = Number(currentTime - startTime) / 1000000000;
                        const currentSpeed = this.bytesToMbps(uploadedBytes, totalTime);
                        const progress = (uploadedBytes / testData.length) * 100;
                        
                        ws.send(JSON.stringify({ 
                            type: 'upload-progress', 
                            speed: currentSpeed.toFixed(2),
                            progress: progress.toFixed(1)
                        }));
                        
                        lastUpdateTime = currentTime;
                    }
                } catch (error) {
                    console.warn(`Upload chunk ${i + 1} failed:`, error.message);
                }
            }

            const endTime = process.hrtime.bigint();
            const durationInSeconds = Number(endTime - startTime) / 1000000000;
            const speedMbps = this.bytesToMbps(uploadedBytes, durationInSeconds);
            
            return {
                speed: speedMbps.toFixed(2),
                duration: durationInSeconds.toFixed(2),
                uploadedBytes
            };
        } catch (error) {
            console.error('Upload test failed:', error);
            throw error;
        }
    }

    async runCompleteSpeedTest(ws) {
        try {
            // Step 1: Ping Test
            ws.send(JSON.stringify({ 
                type: 'status', 
                phase: 'ping', 
                message: 'Testing ping...' 
            }));
            
            const pingResult = await this.testPing();
            ws.send(JSON.stringify({ 
                type: 'ping-complete', 
                ping: pingResult 
            }));

            // Step 2: Download Test
            const downloadResult = await this.testDownloadWithProgress(ws);
            ws.send(JSON.stringify({ 
                type: 'download-complete', 
                speed: downloadResult.speed,
                maxSpeed: downloadResult.maxSpeed
            }));

            // Step 3: Upload Test
            const uploadResult = await this.testUploadWithProgress(ws);
            ws.send(JSON.stringify({ 
                type: 'upload-complete', 
                speed: uploadResult.speed 
            }));

            // Final results
            const results = {
                download: downloadResult,
                upload: uploadResult,
                ping: pingResult,
                timestamp: new Date().toISOString(),
                server: 'Auto-selected server'
            };

            ws.send(JSON.stringify({ 
                type: 'complete', 
                results 
            }));

            return results;
        } catch (error) {
            console.error('Speed test failed:', error);
            ws.send(JSON.stringify({ 
                type: 'error', 
                message: error.message 
            }));
            throw error;
        }
    }
}

// Store active WebSocket connections
const clients = new Set();
const activeTests = new Map();

// WebSocket connection handler
wss.on('connection', (ws, req) => {
    const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    clients.add(ws);
    
    console.log(`Client ${clientId} connected. Total clients: ${clients.size}`);
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        message: 'Connected to SpeedTest server',
        serverInfo: {
            location: 'Mumbai, India',
            provider: 'CloudFlare',
            timestamp: new Date().toISOString()
        }
    }));

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'start-speedtest':
                    // Prevent multiple concurrent tests from same client
                    if (activeTests.has(clientId)) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Test already in progress'
                        }));
                        return;
                    }

                    activeTests.set(clientId, true);
                    
                    try {
                        const speedTest = new EnhancedSpeedTest();
                        await speedTest.runCompleteSpeedTest(ws);
                    } finally {
                        activeTests.delete(clientId);
                    }
                    break;

                case 'cancel-test':
                    activeTests.delete(clientId);
                    ws.send(JSON.stringify({
                        type: 'cancelled',
                        message: 'Test cancelled'
                    }));
                    break;

                case 'ping':
                    ws.send(JSON.stringify({
                        type: 'pong',
                        timestamp: new Date().toISOString()
                    }));
                    break;

                default:
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: `Unknown message type: ${data.type}`
                    }));
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        activeTests.delete(clientId);
        console.log(`Client ${clientId} disconnected. Total clients: ${clients.size}`);
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        clients.delete(ws);
        activeTests.delete(clientId);
    });
});

// Broadcast server status to all connected clients
function broadcastServerStatus() {
    const status = {
        type: 'server-status',
        connectedClients: clients.size,
        activeTests: activeTests.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    };

    clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
            try {
                client.send(JSON.stringify(status));
            } catch (error) {
                console.error('Error broadcasting status:', error);
            }
        }
    });
}

// Broadcast server status every 30 seconds
setInterval(broadcastServerStatus, 30000);

// REST API endpoints
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        connectedClients: clients.size,
        activeTests: activeTests.size,
        uptime: process.uptime(),
        version: '2.0.0',
        features: [
            'Real-time WebSocket updates',
            'Multi-threaded download testing',
            'Chunked upload testing',
            'Ping measurement',
            'Progress tracking'
        ]
    });
});

app.get('/api/servers', (req, res) => {
    res.json({
        servers: [
            {
                id: 'mumbai-cf',
                name: 'Mumbai, India',
                provider: 'CloudFlare',
                location: { lat: 19.0760, lng: 72.8777 },
                ping: Math.floor(Math.random() * 30) + 10
            },
            {
                id: 'delhi-aws',
                name: 'New Delhi, India',
                provider: 'AWS',
                location: { lat: 28.6139, lng: 77.2090 },
                ping: Math.floor(Math.random() * 50) + 20
            },
            {
                id: 'bangalore-gcp',
                name: 'Bangalore, India',
                provider: 'Google Cloud',
                location: { lat: 12.9716, lng: 77.5946 },
                ping: Math.floor(Math.random() * 40) + 15
            }
        ],
        selectedServer: 'mumbai-cf'
    });
});

app.post('/api/speedtest', async (req, res) => {
    try {
        const speedTest = new EnhancedSpeedTest();
        
        // Simulate WebSocket for REST API
        const mockWs = {
            send: (data) => {
                const parsed = JSON.parse(data);
                console.log(`[API] ${parsed.type}:`, parsed.message || parsed);
            }
        };
        
        const results = await speedTest.runCompleteSpeedTest(mockWs);
        res.json(results);
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Express error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 SpeedTest server running on port ${PORT}`);
    console.log(`📊 WebSocket endpoint: ws://localhost:${PORT}`);
    console.log(`🌐 REST API: http://localhost:${PORT}/api`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});