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
  // Wait for patches to be applied before initializing Clarity
  setTimeout(() => Clarity.init('qu6uzrb8ru'), 0);
} else {
  Clarity.init('qu6uzrb8ru');
}

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
