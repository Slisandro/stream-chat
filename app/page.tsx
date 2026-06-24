"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Chat from './components/Chat';
import Sidebar from './components/Sidebar';

export default function Home() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = io({
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Conectado al servidor');
      setSocketReady(true);
      setError('');
    });

    socket.on('connect_error', (connectError) => {
      console.error('Error de conexion socket:', connectError.message);
      setSocketReady(false);
      setError('No se pudo conectar al servidor de chat.');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const logout = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.disconnect();
      socketRef.current = null;
    }
    const newSocket = io({
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
    });
    socketRef.current = newSocket;
    newSocket.on('connect', () => {
      setSocketReady(true);
      setError('');
    });
    newSocket.on('connect_error', (connectError) => {
      console.error('Error de conexion socket:', connectError.message);
      setSocketReady(false);
      setError('No se pudo conectar al servidor de chat.');
    });
    setConnected(false);
    setUsername('');
    setError('');
    setSocketReady(false);
  }, []);

  const joinChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socketReady) {
      setError('El servidor de chat aun no esta listo. Intenta de nuevo en unos segundos.');
      return;
    }

    if (username.trim()) {
      socketRef.current!.emit('user-join', username.trim());
      setConnected(true);
      setError('');
    } else {
      setError('Por favor ingresa un nombre de usuario');
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-surface-container-lowest rounded-lg p-6 sm:p-8 max-w-md w-full border border-white/10">
          <h1 className="text-headline-md sm:text-headline-lg text-primary font-black mb-2">Stream Chat</h1>
          <p className="text-on-surface-variant text-body-sm sm:text-body-md mb-6">Únete a la conversación grupal</p>

          <form onSubmit={joinChat}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu nombre de usuario"
              className="w-full bg-surface-container-high border border-white/10 rounded-lg px-4 py-3 text-body-md focus:ring-2 focus:ring-primary transition-all mb-4"
            />
            {error && <p className="text-red-500 text-xs sm:text-sm mb-4">{error}</p>}
            <button
              type="submit"
              className="w-full bg-primary text-on-primary py-3 rounded-lg font-label-bold hover:brightness-110 transition-all text-body-md"
            >
              Entrar al Chat
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-label-bold text-on-surface-variant text-center text-body-xs sm:text-body-sm">
              ¡Charla grupal en tiempo real con
              <a href="https://socket.io/" target="_blank" rel="noopener noreferrer" className="text-primary underline ml-1">
                socket.io
              </a>!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="bg-surface/80 backdrop-blur-md border-b border-white/10 px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between sticky top-0 z-50 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-headline-sm sm:text-headline-lg font-black text-primary truncate">
            Stream Chat
          </span>
          <span className="text-body-xs sm:text-body-sm bg-primary/20 text-primary px-1.5 sm:px-2 py-0.5 sm:py-1 rounded whitespace-nowrap">
            Chat Grupal
          </span>
        </div>
        <div className="text-on-surface-variant text-body-xs sm:text-body-sm truncate ml-2 flex items-center gap-1">
          <span className="hidden xs:inline">Conectado como</span>
          <span className="text-primary font-bold truncate max-w-[100px] xs:max-w-[150px] sm:max-w-none">
            {username}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden flex-col sm:flex-row">
        <div className="w-full sm:w-auto sm:flex-shrink-0">
          <Sidebar 
            // eslint-disable-next-line react-hooks/refs
            socket={socketRef.current!} 
            currentUser={username} 
            onLogout={logout} 
          />
        </div>
        
        {/* CHAT - Ocupa el resto del espacio */}
        <div className="flex-1 min-h-0">
          {/* eslint-disable-next-line react-hooks/refs */}
          <Chat socket={socketRef.current!} currentUser={username} />
        </div>
      </div>
    </div>
  );
}