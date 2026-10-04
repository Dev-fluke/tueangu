self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : { title: 'แจ้งเตือน', body: 'ถึงเวลาที่คุณตั้งไว้แล้วครับ' };
  
  const options = {
    body: data.body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    data: {
      url: '/',
      text: data.body
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  // Send message to the window to speak the text
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        let client = windowClients[i];
        if (client.url === self.registration.scope && 'focus' in client) {
          client.postMessage({ type: 'SPEAK', text: event.notification.data.text });
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow('/').then(client => {
          if (client) {
            // Need a tiny delay for the window to load before sending message
            setTimeout(() => {
              client.postMessage({ type: 'SPEAK', text: event.notification.data.text });
            }, 1000);
          }
        });
      }
    })
  );
});
