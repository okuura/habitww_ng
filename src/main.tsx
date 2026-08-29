import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Roboto font (latin subset only — avoids 40+ unused cyrillic/greek/vietnamese files)
import '@fontsource/roboto/latin-300.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-700.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
