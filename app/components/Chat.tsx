"use client";

import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

interface User {
    name: string;
    color: string;
    badges: string[];
}

interface Message {
    id: number;
    user: User | { name: string; color: string; badges: string[] };
    text: string;
    timestamp: Date;
    system?: boolean;
}

interface PrivateMessage {
    id: number;
    from: string;
    fromColor: string;
    text: string;
    timestamp: Date;
    isPrivate: boolean;
}

interface ChatProps {
    socket: Socket;
    currentUser: string;
}

export default function Chat({ socket, currentUser }: ChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isNearBottom, setIsNearBottom] = useState(true);

    useEffect(() => {
        const onHistory = (history: Message[]) => setMessages(history);
        const onMessage = (message: Message) => setMessages(prev => [...prev, message]);
        const onTyping = ({ user, isTyping }: { user: string; isTyping: boolean }) => {
            setTypingUsers(prev => {
                const newSet = new Set(prev);
                if (isTyping) newSet.add(user);
                else newSet.delete(user);
                return newSet;
            });
        };

        const onClearChat = () => {
            setMessages([]);
        };

        const onPrivateMessage = (data: PrivateMessage) => {
            const privateMsg: Message = {
                id: data.id,
                user: {
                    name: `🔒 ${data.from} (privado)`,
                    color: data.fromColor,
                    badges: ['star']
                },
                text: `🤫 ${data.text}`,
                timestamp: new Date(data.timestamp),
                system: true
            };
            setMessages(prev => [...prev, privateMsg]);
        };

        socket.on('chat-history', onHistory);
        socket.on('chat-message', onMessage);
        socket.on('user-typing', onTyping);
        socket.on('clear-chat', onClearChat);
        socket.on('private-message', onPrivateMessage);

        socket.emit('request-chat-history');

        return () => {
            socket.off('chat-history', onHistory);
            socket.off('chat-message', onMessage);
            socket.off('user-typing', onTyping);
            socket.off('clear-chat', onClearChat);
            socket.off('private-message', onPrivateMessage);
        };
    }, [socket]);

    useEffect(() => {
        if (isNearBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isNearBottom]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setIsNearBottom(nearBottom);
    };

    const typingTimeout = useRef<NodeJS.Timeout | null>(null);
    const handleTyping = (isTyping: boolean) => {
        socket.emit('typing', isTyping);
        if (isTyping && typingTimeout.current) {
            clearTimeout(typingTimeout.current);
            typingTimeout.current = setTimeout(() => {
                socket.emit('typing', false);
            }, 1000);
        }
    };

    // Función para formatear el texto de "escribiendo"
    const getTypingText = () => {
        const users = Array.from(typingUsers);
        if (users.length === 0) return '';
        if (users.length === 1) return `${users[0]} está escribiendo...`;
        if (users.length === 2) return `${users[0]} y ${users[1]} están escribiendo...`;
        return `${users[0]} y ${users.length - 1} más están escribiendo...`;
    };

    return (
        <main className="flex-1 flex flex-col bg-surface-container-low h-full">
            {/* Header del chat - Responsive */}
            <div className="h-12 sm:h-14 border-b border-white/5 flex items-center justify-between px-3 sm:px-4 flex-shrink-0 bg-surface-container">
                <span className="text-body-xs sm:text-label-bold font-label-bold uppercase tracking-widest text-on-surface-variant truncate">
                    Chat Grupal • {messages.length} {messages.length === 1 ? 'mensaje' : 'mensajes'}
                </span>
                <div className="flex items-center gap-2 min-w-0">
                    {typingUsers.size > 0 && (
                        <span className="text-body-xs sm:text-body-sm text-primary animate-pulse truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">
                            {getTypingText()}
                        </span>
                    )}
                </div>
            </div>

            {/* Área de mensajes - Responsive con scroll */}
            <div
                className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4 flex flex-col gap-[2px] sm:gap-1 chat-scrollbar"
                onScroll={handleScroll}
            >
                {messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center text-on-surface-variant">
                            <p className="text-body-lg sm:text-headline-sm mb-2">💬</p>
                            <p className="text-body-sm sm:text-body-md">No hay mensajes aún</p>
                            <p className="text-body-xs sm:text-body-sm opacity-60">¡Sé el primero en enviar un mensaje!</p>
                        </div>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <ChatMessage 
                            key={msg.id || idx} 
                            message={msg} 
                            currentUser={currentUser} 
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input del chat - Responsive */}
            <div className="flex-shrink-0 p-2 sm:p-3 md:p-4 border-t border-white/5 bg-surface-container">
                <ChatInput 
                    onSendMessage={(text) => socket.emit('chat-message', { text })} 
                    onTyping={handleTyping} 
                />
            </div>
        </main>
    );
}