import { useState, useEffect, useRef } from 'react';
import { Activity, Download, Upload, RefreshCw, Wifi, Clock, BarChart2, Globe, Settings, HelpCircle, User, Star, Shield, Gauge } from 'lucide-react';

const OoklaSpeedometer = ({ currentSpeed, maxSpeed = 1000, testPhase, isLoading, ping }) => {
  const displaySpeed = currentSpeed || 31.19;
  const speedRatio = Math.min(displaySpeed / maxSpeed, 1);
  const angle = speedRatio * 270; // 0 to 270 degrees for more coverage
  
  // Calculate the path for the progress arc
  const radius = 100;
  const centerX = 160;
  const centerY = 160;
  const startAngle = 135; // Start from bottom left
  const endAngle = startAngle + 270; // 270 degrees coverage
  
  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };
  
  const describeArc = (x, y, radius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", start.x, start.y, 
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
  };
  
  const backgroundPath = describeArc(centerX, centerY, radius, startAngle, endAngle);
  const progressPath = describeArc(centerX, centerY, radius, startAngle, startAngle + angle);
  
  return (
    <div className="relative flex flex-col items-center">
      <svg width="320" height="280" viewBox="0 0 320 280" className="mb-4">
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background track */}
        <path
          d={backgroundPath}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        
        {/* Progress arc */}
        <path
          d={progressPath}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth="16"
          strokeLinecap="round"
          filter="url(#glow)"
          className="transition-all duration-700 ease-out"
        />
        
        {/* Speed markings */}
        {[
          { value: 0, angle: 135 },
          { value: 5, angle: 155 },
          { value: 10, angle: 175 },
          { value: 50, angle: 215 },
          { value: 100, angle: 255 },
          { value: 250, angle: 295 },
          { value: 500, angle: 335 },
          { value: 750, angle: 375 },
          { value: 1000, angle: 405 }
        ].map(({ value, angle: markAngle }) => {
          const point = polarToCartesian(centerX, centerY, radius + 25, markAngle);
          
          return (
            <text
              key={value}
              x={point.x} 
              y={point.y}
              textAnchor="middle"
              fill="rgba(255,255,255,0.6)"
              fontSize="13"
              fontWeight="500"
              dy="4"
            >
              {value}
            </text>
          );
        })}
        
        {/* Center speed display */}
        <text
          x={centerX} 
          y={centerY - 10}
          textAnchor="middle"
          fill="#ffffff"
          fontSize="48"
          fontWeight="700"
          className="font-mono"
        >
          {displaySpeed.toFixed(2)}
        </text>
        
        {/* Mbps label */}
        <text
          x={centerX} 
          y={centerY + 25}
          textAnchor="middle"
          fill="#a855f7"
          fontSize="16"
          fontWeight="500"
        >
          Mbps
        </text>
        
        {/* Subtle inner circle */}
        <circle 
          cx={centerX} 
          cy={centerY} 
          r="65" 
          fill="none" 
          stroke="rgba(255,255,255,0.03)" 
          strokeWidth="1"
        />
      </svg>
      
      {/* Test status */}
      {testPhase && (
        <div className="text-center text-white text-sm font-medium mb-4">
          {testPhase === 'download' ? (
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-purple-400" />
              Testing Download Speed
            </div>
          ) : testPhase === 'upload' ? (
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-purple-400" />
              Testing Upload Speed
            </div>
          ) : (
            'Speed Test Complete'
          )}
        </div>
      )}
    </div>
  );
};

export default function SpeedTest() {
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState({ download: { speed: 31.19 }, upload: { speed: 15.2 } });
  const [error, setError] = useState(null);
  const [testHistory, setTestHistory] = useState([]);
  const [currentSpeed, setCurrentSpeed] = useState(31.19);
  const [testPhase, setTestPhase] = useState(null);
  const [finalDownload, setFinalDownload] = useState(31.19);
  const [finalUpload, setFinalUpload] = useState(15.2);
  const [ping, setPing] = useState(28);
  const [serverLocation, setServerLocation] = useState('Auto');
  const wsRef = useRef(null);

  useEffect(() => {
    setServerLocation('Mumbai, India');
    setPing(Math.floor(Math.random() * 50) + 10);
  }, []);

  useEffect(() => {
    if (results?.download?.speed && results?.upload?.speed) {
      setTestHistory(prev => [...prev, { 
        ...results, 
        id: Date.now(), 
        timestamp: Date.now(),
        ping: ping,
        server: serverLocation
      }].slice(-10));
    }
  }, [results, ping, serverLocation]);

  const startTest = () => {
    setTesting(true);
    setError(null);
    setStatus('Connecting to server...');
    setResults({ download: { speed: 0 }, upload: { speed: 0 } });
    setCurrentSpeed(0);
    setTestPhase(null);
    setFinalDownload(0);
    setFinalUpload(0);

    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket('ws://localhost:3000');
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('Connected! Starting speed test...');
        ws.send(JSON.stringify({ type: 'start-speedtest' }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'connected':
              setStatus('Connected to server');
              setServerLocation(data.serverInfo?.location || 'Auto');
              break;

            case 'ping-complete':
              setPing(data.ping);
              break;

            case 'download-progress':
              setCurrentSpeed(parseFloat(data.speed));
              setTestPhase('download');
              setResults(prev => ({ ...prev, download: { speed: parseFloat(data.speed) } }));
              break;

            case 'download-complete':
              const downloadSpeed = parseFloat(data.speed);
              setFinalDownload(downloadSpeed);
              setCurrentSpeed(downloadSpeed);
              setResults(prev => ({ ...prev, download: { speed: downloadSpeed } }));
              setStatus('Download test complete. Starting upload...');
              break;

            case 'upload-progress':
              setCurrentSpeed(parseFloat(data.speed));
              setTestPhase('upload');
              break;

            case 'upload-complete':
              const uploadSpeed = parseFloat(data.speed);
              setFinalUpload(uploadSpeed);
              setCurrentSpeed(uploadSpeed);
              setResults(prev => ({ ...prev, upload: { speed: uploadSpeed } }));
              setStatus('Upload test complete.');
              break;

            case 'complete':
              const results = data.results;
              setResults({
                download: { speed: parseFloat(results.download.speed) },
                upload: { speed: parseFloat(results.upload.speed) }
              });
              setFinalDownload(parseFloat(results.download.speed));
              setFinalUpload(parseFloat(results.upload.speed));
              setPing(results.ping);
              setCurrentSpeed(0);
              setTestPhase(null);
              setStatus('Test complete!');
              setTesting(false);
              ws.close();
              break;

            case 'status':
              setStatus(data.message);
              if (data.phase === 'download') {
                setTestPhase('download');
              } else if (data.phase === 'upload') {
                setTestPhase('upload');
              } else if (data.phase === 'ping') {
                setStatus('Testing connection latency...');
              }
              break;

            case 'error':
              setError(data.message);
              setTesting(false);
              setTestPhase(null);
              ws.close();
              break;

            case 'server-status':
              console.log('Server status:', data);
              break;

            default:
              console.log('Unknown message type:', data.type);
          }
        } catch (parseError) {
          console.error('Error parsing WebSocket message:', parseError);
          setStatus(event.data);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error. Please check if the backend server is running on localhost:3000');
        setTesting(false);
        setTestPhase(null);
      };

      ws.onclose = (event) => {
        if (event.code !== 1000) {
          console.log('WebSocket closed unexpectedly:', event.code, event.reason);
          if (testing) {
            setError('Connection lost. Please try again.');
            setTesting(false);
            setTestPhase(null);
          }
        }
      };

      const cleanup = () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };

      const testTimeout = setTimeout(() => {
        if (testing) {
          setError('Test timed out. Please try again.');
          setTesting(false);
          setTestPhase(null);
          cleanup();
        }
      }, 60000);

      const originalOnMessage = ws.onmessage;
      ws.onmessage = (event) => {
        originalOnMessage(event);
        const data = JSON.parse(event.data);
        if (data.type === 'complete' || data.type === 'error') {
          clearTimeout(testTimeout);
        }
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setError('Failed to connect to test server. Please ensure the backend is running.');
      setTesting(false);
      setTestPhase(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      {/* Header Navigation */}
      <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Gauge className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">SpeedTest</span>
            </div>
            
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#" className="text-gray-300 hover:text-white transition-colors">Test</a>
              <a href="#" className="text-gray-300 hover:text-white transition-colors">Results</a>
              <a href="#" className="text-gray-300 hover:text-white transition-colors">Apps</a>
              <a href="#" className="text-gray-300 hover:text-white transition-colors">Enterprise</a>
            </nav>
            
            <div className="flex items-center gap-4">
              <button className="text-gray-300 hover:text-white transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              <button className="text-gray-300 hover:text-white transition-colors">
                <HelpCircle className="w-5 h-5" />
              </button>
              <button className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-2 rounded-lg transition-all hover:from-purple-600 hover:to-purple-700">
                <User className="w-4 h-4 inline mr-2" />
                Sign In
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          {/* Server Selection Bar */}
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl p-4 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-white font-medium">Test Server</div>
                  <div className="text-gray-400 text-sm">{serverLocation}</div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-gray-400 text-sm">Your IP</div>
                  <div className="text-white font-mono">203.***.***.123</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400 text-sm">ISP</div>
                  <div className="text-white">Jio Fiber</div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Test Interface */}
          <div className="bg-gray-800/30 backdrop-blur border border-gray-700/50 rounded-2xl p-8 mb-8">
            {/* Speed Indicators */}
            <div className="grid grid-cols-3 gap-8 mb-8">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Download className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-gray-400 text-sm font-medium">DOWNLOAD</span>
                </div>
                <div className="text-4xl font-bold text-white mb-1">
                  {finalDownload > 0 ? finalDownload.toFixed(2) : '31.19'}
                </div>
                <div className="text-sm text-gray-500">Mbps</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <Activity className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="text-gray-400 text-sm font-medium">PING</span>
                </div>
                <div className="text-4xl font-bold text-white mb-1">
                  {ping > 0 ? ping : '28'}
                </div>
                <div className="text-sm text-gray-500">ms</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Upload className="w-4 h-4 text-orange-400" />
                  </div>
                  <span className="text-gray-400 text-sm font-medium">UPLOAD</span>
                </div>
                <div className="text-4xl font-bold text-white mb-1">
                  {finalUpload > 0 ? finalUpload.toFixed(2) : '15.20'}
                </div>
                <div className="text-sm text-gray-500">Mbps</div>
              </div>
            </div>

            {/* Speedometer */}
            <div className="flex justify-center mb-8">
              <OoklaSpeedometer 
                currentSpeed={currentSpeed}
                maxSpeed={1000}
                testPhase={testPhase}
                isLoading={testing}
                ping={ping}
              />
            </div>

            {/* Test Button */}
            <div className="flex justify-center mb-6">
              <button
                onClick={startTest}
                disabled={testing}
                className={`
                  flex items-center gap-3 px-12 py-4 rounded-full font-semibold text-lg
                  transition-all duration-300 transform
                  ${testing 
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 hover:scale-105 shadow-lg hover:shadow-purple-500/25'
                  }
                `}
              >
                {testing ? (
                  <>
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Activity className="w-6 h-6" />
                    GO
                  </>
                )}
              </button>
            </div>

            {status && (
              <div className="text-center text-white flex items-center justify-center gap-2">
                <span className="text-lg">{status}</span>
              </div>
            )}

            {error && (
              <div className="mt-4 text-red-400 bg-red-900/20 border border-red-500/30 p-4 rounded-xl text-center">
                {error}
              </div>
            )}
          </div>

          {/* Test History */}
          {testHistory.length > 0 && (
            <div className="bg-gray-800/30 backdrop-blur border border-gray-700/50 rounded-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-purple-400" />
                  </div>
                  <h2 className="text-2xl font-semibold text-white">Recent Tests</h2>
                </div>
                <button className="text-gray-400 hover:text-white text-sm transition-colors">View All</button>
              </div>
              
              <div className="space-y-3">
                {testHistory.slice(0, 5).map((test, index) => (
                  <div
                    key={test.id}
                    className="flex items-center justify-between p-4 bg-gray-700/30 border border-gray-600/30 rounded-xl
                      hover:bg-gray-700/50 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <BarChart2 className="w-4 h-4 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-300">
                          {new Date(test.timestamp).toLocaleTimeString()}
                        </p>
                        <p className="text-xs text-gray-500">{test.server}</p>
                      </div>
                    </div>
                    <div className="flex gap-8 text-sm">
                      <div className="text-center">
                        <div className="text-white font-medium">↓ {test.download?.speed?.toFixed(2) || '0'}</div>
                        <div className="text-gray-500 text-xs">Mbps</div>
                      </div>
                      <div className="text-center">
                        <div className="text-white font-medium">{test.ping} ms</div>
                        <div className="text-gray-500 text-xs">ping</div>
                      </div>
                      <div className="text-center">
                        <div className="text-white font-medium">↑ {test.upload?.speed?.toFixed(2) || '0'}</div>
                        <div className="text-gray-500 text-xs">Mbps</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900/50 backdrop-blur border-t border-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Gauge className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">SpeedTest</span>
              </div>
              <p className="text-gray-400 text-sm">
                The global standard for internet speed testing.
              </p>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Products</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Speed Test</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Mobile Apps</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Enterprise</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Help</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-500 text-sm">
              © 2025 SpeedTest. All rights reserved.
            </p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-purple-400 fill-current" />
                <span className="text-gray-400 text-sm">Trusted by millions</span>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="w-4 h-4 text-purple-400" />
                <span className="text-gray-400 text-sm">Privacy protected</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}