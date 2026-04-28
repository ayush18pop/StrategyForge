import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import 'reactflow/dist/style.css';
import { Providers } from './app/providers';
import { router } from './app/router';
import './styles/globals.css';
import './styles/app-pages.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
