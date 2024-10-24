import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { SpeedTest } from './speedtest.js';  // Our existing speed test code

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Store active WebSocket connections
const clients = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
  clients.add(ws);
  
  ws.on('close', () => {
    clients.delete(ws);
  });
});

// Broadcast status to all connected clients
function broadcastStatus(status) {
  clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(status);
    }
  });
}

app.get('/speedtest', async (req, res) => {
  try {
    const speedTest = new SpeedTest();
    
    // Override the console.log in SpeedTest to broadcast status
    const originalLog = console.log;
    console.log = (message) => {
      originalLog(message);
      broadcastStatus(message);
    };
    
    const results = await speedTest.runSpeedTest();
    
    // Restore original console.log
    console.log = originalLog;
    
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});