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

        socket.on('chat-history', onHistory);
        socket.on('chat-message', onMessage);
        socket.on('user-typing', onTyping);

        socket.emit('request-chat-history');

        return () => {
            socket.off('chat-history', onHistory);
            socket.off('chat-message', onMessage);
            socket.off('user-typing', onTyping);
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

    return (
        <main className="flex-1 flex flex-col bg-surface-container-low">
            <div className="h-12 border-b border-white/5 flex items-center justify-between px-4 flex-shrink-0 bg-surface-container">
                <span className="text-label-bold font-label-bold uppercase tracking-widest text-on-surface-variant">
                    Chat Grupal • {messages.length} mensajes
                </span>
                <div className="flex items-center gap-2">
                    {typingUsers.size > 0 && (
                        <span className="text-body-sm text-primary animate-pulse">
                            {Array.from(typingUsers).join(', ')} está{typingUsers.size === 1 ? '' : 'n'} escribiendo...
                        </span>
                    )}
                </div>
            </div>

            <div
                className="flex-1 overflow-y-auto p-2 flex flex-col gap-[2px] chat-scrollbar"
                onScroll={handleScroll}
            >
                {messages.map((msg, idx) => (
                    <ChatMessage key={msg.id || idx} message={msg} currentUser={currentUser} />
                ))}
                <div ref={messagesEndRef} />
            </div>

            <ChatInput onSendMessage={(text) => socket.emit('chat-message', { text })} onTyping={handleTyping} />
        </main>
    );
}