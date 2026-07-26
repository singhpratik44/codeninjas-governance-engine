import React from 'react';
import ReactDOM from 'react-dom/client';
import TriageCommandCenter from './TriageCommandCenter';

window.__BUILD_SHA__ = '__BUILD_SHA__';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TriageCommandCenter initialTab={window.location.hash.slice(1) || 'queue'} />
  </React.StrictMode>,
);
