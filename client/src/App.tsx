import { useState, useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

function App() {
  // Connect to your Codespaces Backend URL
  // NOTE: In Codespaces, this will be handled by the proxy, but usually ws://localhost:3000 work internally
  // If it fails, you might need the full Codespace URL (e.g. wss://your-space-3000.github.dev/ws)
  const socketUrl = 'ws://localhost:3000/ws'; 
  const { sendMessage, lastMessage } = useWebSocket(socketUrl);
  
  const [imageSrc, setImageSrc] = useState('');
  const [urlInput, setUrlInput] = useState('https://google.com');
  const imgRef = useRef<HTMLImageElement>(null);

  // 1. Render the Video Stream
  useEffect(() => {
    if (lastMessage !== null) {
      // Create a URL from the blob (screenshot) received
      const blob = new Blob([lastMessage.data], { type: 'image/jpeg' });
      setImageSrc(URL.createObjectURL(blob));
    }
  }, [lastMessage]);

  // 2. Handle Mouse Clicks
  const handleImageClick = (e: React.MouseEvent) => {
    if (!imgRef.current) return;
    
    // Calculate where you clicked relative to the image
    const rect = imgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    sendMessage(JSON.stringify({ type: 'click', x, y }));
  };

  // 3. Handle Navigation
  const handleNavigate = () => {
    sendMessage(JSON.stringify({ type: 'navigate', url: urlInput }));
  };

  return (
    <div style={{ padding: 20, background: '#333', minHeight: '100vh', color: 'white' }}>
      <div style={{ marginBottom: 10, display: 'flex', gap: 10 }}>
        <input 
          value={urlInput} 
          onChange={(e) => setUrlInput(e.target.value)} 
          style={{ flex: 1, padding: 5 }}
        />
        <button onClick={handleNavigate} style={{ padding: '5px 20px' }}>Go</button>
      </div>

      <div style={{ border: '2px solid #555', display: 'inline-block' }}>
        {imageSrc && (
          <img 
            ref={imgRef}
            src={imageSrc} 
            onClick={handleImageClick}
            style={{ display: 'block', cursor: 'pointer' }}
            alt="Remote Browser"
          />
        )}
        {!imageSrc && <p>Connecting to Cloud Browser...</p>}
      </div>
      
      <p style={{ fontSize: '0.8rem', color: '#aaa' }}>
        Cloud Browser active. Clicks are sent to server.
      </p>
    </div>
  );
}

export default App;