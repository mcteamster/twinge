import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import Clarity from '@microsoft/clarity';
import { initaliseDiscord } from './constants/discord';

// Initialise Discord Integration first (applies URL patches)
const isDiscord = initaliseDiscord();

// Initialize Clarity after patches are applied
if (isDiscord) {
  // Wait for MutationObserver to be set up before initializing Clarity
  requestAnimationFrame(() => {
    requestAnimationFrame(() => Clarity.init('qu6uzrb8ru'));
  });
} else {
  Clarity.init('qu6uzrb8ru');
}

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
