import { useState, useEffect } from 'react';
import { Activity, Download, Upload, RefreshCw, Wifi, Clock, BarChart2 } from 'lucide-react';

const SpeedGauge = ({ value, max = 100, label, isLoading, colorStart, colorEnd }) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <div className="relative transform hover:scale-105 transition-transform duration-300">
      <svg className="w-48 h-48" viewBox="0 0 100 100">
        <defs>
          <linearGradient id={`gradient-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorStart} />
            <stop offset="100%" stopColor={colorEnd} />
          </linearGradient>
        </defs>
        
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${Math.PI * 90 * 0.75} ${Math.PI * 90 * 0.25}`}
          transform="rotate(-90 50 50)"
          className="animate-pulse"
        />
        
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={`url(#gradient-${label})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${Math.PI * 90 * 0.75 * percentage / 100} ${Math.PI * 90}`}
          transform="rotate(-90 50 50)"
          className={`
            ${isLoading ? "animate-pulse" : "transition-all duration-1000 ease-out"}
            drop-shadow-lg
          `}
        />
        
        <g className={isLoading ? "animate-pulse" : "animate-fade-in"}>
          <text 
            x="50" 
            y="45" 
            textAnchor="middle" 
            className="text-2xl font-bold"
            fill="currentColor"
          >
            {isLoading ? "..." : value}
          </text>
          <text 
            x="50" 
            y="65" 
            textAnchor="middle" 
            className="text-sm" 
            fill="currentColor"
          >
            Mbps
          </text>
        </g>
      </svg>
      <div className="text-center mt-2 font-medium bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
        {label}
      </div>
    </div>
  );
};

export default function SpeedTest() {
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [testHistory, setTestHistory] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (results) {
      setTestHistory(prev => [...prev, { ...results, id: Date.now() }].slice(-5));
    }
  }, [results]);

  const startTest = async () => {
    try {
      setTesting(true);
      setError(null);
      setStatus('Initializing speed test...');
      setResults(null);

      const ws = new WebSocket('ws://localhost:3000');
      ws.onmessage = (event) => {
        setStatus(event.data);
      };

      const response = await fetch('http://localhost:3000/speedtest');
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      
      ws.close();
      setResults(data);
    } catch (err) {
      setError('Failed to run speed test. Please make sure the backend server is running.');
      console.error('Speed test failed:', err);
    } finally {
      setTesting(false);
      setStatus('');
    }
  };

  return (
    <div className={`
      min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8
      ${mounted ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500
    `}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12 transform hover:scale-105 transition-transform duration-300">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Wifi className="w-8 h-8 text-blue-400 animate-pulse" />
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
              Speed Test
            </h1>
          </div>
          <p className="text-gray-300 max-w-xl mx-auto">
            Test your internet connection speed with our advanced diagnostics tool
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 mb-8 transform hover:scale-[1.01] transition-all duration-300">
          <div className="flex justify-center mb-8">
            <button
              onClick={startTest}
              disabled={testing}
              className={`
                flex items-center gap-2 px-8 py-4 rounded-xl font-medium text-lg
                shadow-lg transform transition-all duration-300 
                ${testing 
                  ? 'bg-gray-600/50 text-gray-300 cursor-not-allowed translate-y-0' 
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/25'
                }
              `}
            >
              {testing ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  Running Test...
                </>
              ) : (
                <>
                  <Activity className="w-6 h-6" />
                  Start Speed Test
                </>
              )}
            </button>
          </div>

          {status && (
            <div className="text-center mb-8 text-blue-300 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-lg animate-pulse">{status}</span>
            </div>
          )}

          {error && (
            <div className="mb-8 text-red-400 bg-red-900/20 border border-red-500/20 p-4 rounded-xl text-center animate-fade-in">
              {error}
            </div>
          )}

          <div className="flex flex-col md:flex-row justify-center items-center gap-12 mb-8">
            <SpeedGauge
              value={results?.download?.speed || 0}
              label="Download Speed"
              isLoading={testing}
              colorStart="#3b82f6"
              colorEnd="#8b5cf6"
              max={150}
            />
            <SpeedGauge
              value={results?.upload?.speed || 0}
              label="Upload Speed"
              isLoading={testing}
              colorStart="#10b981"
              colorEnd="#3b82f6"
              max={150}
            />
          </div>

          {results && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/5 backdrop-blur-lg rounded-xl p-6 animate-fade-in">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-400">
                  <Download className="w-5 h-5" />
                  <span className="font-medium">Download Details</span>
                </div>
                <p className="text-gray-300">Speed: {results.download?.speed} Mbps</p>
                <p className="text-gray-300">Tests: {results.download?.duration}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Upload className="w-5 h-5" />
                  <span className="font-medium">Upload Details</span>
                </div>
                <p className="text-gray-300">Speed: {results.upload?.speed} Mbps</p>
                <p className="text-gray-300">Duration: {results.upload?.duration}s</p>
              </div>
            </div>
          )}
        </div>

        {testHistory.length > 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 transform hover:scale-[1.01] transition-all duration-300">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-semibold text-white">Recent Tests</h2>
            </div>
            <div className="space-y-4">
              {testHistory.map((test, index) => (
                <div
                  key={test.id}
                  className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-lg rounded-xl
                    hover:bg-white/10 transition-all duration-300 transform hover:scale-[1.02]
                    animate-fade-in"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <BarChart2 className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-400">
                        {new Date(test.timestamp).toLocaleString()}
                      </p>
                      <div className="flex gap-6 mt-1">
                        <p className="text-sm text-gray-300">
                          <span className="text-blue-400 font-medium">↓</span> {test.download?.speed} Mbps
                        </p>
                        <p className="text-sm text-gray-300">
                          <span className="text-emerald-400 font-medium">↑</span> {test.upload?.speed} Mbps
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}