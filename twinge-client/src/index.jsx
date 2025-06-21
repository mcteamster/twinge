import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import Clarity from '@microsoft/clarity';
import { initaliseDiscord } from './constants/discord';

// Initialize Clarity
Clarity.init('qu6uzrb8ru');

// Initialise Discord Integration
initaliseDiscord();

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
