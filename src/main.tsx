import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import '@fontsource/amiri/400.css';
import '@fontsource/amiri/700.css';
import './index.css';
import App from './App';
import { CloudProvider } from './data/cloud';
import { initStore } from './data/store';

// Сначала загружаем данные с устройства (и при необходимости переносим их из старой версии),
// затем отрисовываем приложение — так экраны никогда не видят «пустое» состояние.
initStore().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HashRouter>
        <CloudProvider>
          <App />
        </CloudProvider>
      </HashRouter>
    </React.StrictMode>,
  );
});
