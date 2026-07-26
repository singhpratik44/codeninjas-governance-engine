import React from 'react';
import ReactDOM from 'react-dom/client';
import RuntimeGovernanceEngine from './RuntimeGovernanceEngine.tsx';

window.__BUILD_SHA__ = window.__BUILD_SHA__ || 'local';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <RuntimeGovernanceEngine initialTab={window.location.hash.slice(1) || 'research'} />
  </React.StrictMode>
);
