// Keep-alive: ping the server every 5 minutes to prevent Render from sleeping
// This runs on all pages and keeps the server awake while users are active

(function() {
  const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes
  const PING_URL = '/api/ping';
  
  let lastActivity = Date.now();
  let pingInterval = null;
  
  // Track user activity
  function updateActivity() {
    lastActivity = Date.now();
  }
  
  // Listen for user activity
  ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'].forEach(event => {
    document.addEventListener(event, updateActivity, { passive: true });
  });
  
  // Ping function
  async function ping() {
    // Only ping if user was active in the last 30 minutes
    const inactiveTime = Date.now() - lastActivity;
    const thirtyMinutes = 30 * 60 * 1000;
    
    if (inactiveTime > thirtyMinutes) {
      console.log('[Keep-alive] User inactive, skipping ping');
      return;
    }
    
    try {
      const response = await fetch(PING_URL, { 
        method: 'GET',
        cache: 'no-store'
      });
      
      if (response.ok) {
        console.log('[Keep-alive] Ping successful');
      }
    } catch (err) {
      console.log('[Keep-alive] Ping failed:', err.message);
    }
  }
  
  // Start pinging
  function startKeepAlive() {
    // Initial ping after 1 minute
    setTimeout(ping, 60 * 1000);
    
    // Then ping every 5 minutes
    pingInterval = setInterval(ping, PING_INTERVAL);
    
    console.log('[Keep-alive] Started - pinging every 5 minutes');
  }
  
  // Stop pinging when page is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
        console.log('[Keep-alive] Paused - page hidden');
      }
    } else {
      if (!pingInterval) {
        startKeepAlive();
      }
    }
  });
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startKeepAlive);
  } else {
    startKeepAlive();
  }
})();
