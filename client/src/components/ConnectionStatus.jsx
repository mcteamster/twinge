import React from 'react';

export const ConnectionStatus = ({ isConnected }) => {
  return (
    <div 
      className="connection-status"
      style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: isConnected ? '#22c55e' : '#ef4444',
        zIndex: 1000,
        boxShadow: '0 0 4px rgba(0,0,0,0.3)',
        transition: 'background-color 0.3s ease'
      }}
      title={isConnected ? 'Connected' : 'Disconnected'}
    />
  );
};
