import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return (
    <main>
      <h1>Heating oil price alerts</h1>
      <p>Price data and subscriptions will appear here.</p>
      <p>API health endpoint: <a href="http://localhost:3000/health">localhost:3000/health</a></p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
