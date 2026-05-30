"use client";

import { useState, useRef } from 'react';

interface ChatInputProps {
    onSendMessage: (text: string) => void;
    onTyping: (isTyping: boolean) => void;
}

export default function ChatInput({ onSendMessage, onTyping }: ChatInputProps) {
    const [message, setMessage] = useState('');
    const typingTimeout = useRef<NodeJS.Timeout | null>(null);

    const handleSend = () => {
        if (message.trim()) {
            onSendMessage(message.trim());
            setMessage('');
            onTyping(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        onTyping(true);

        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => {
            onTyping(false);
        }, 1000);
    };

    return (
        <div className="p-4 border-t border-white/5 glass-input">
            <div className="relative">
                <textarea
                    value={message}
                    onChange={handleChange}
                    onKeyPress={handleKeyPress}
                    placeholder="Escribe un mensaje..."
                    rows={1}
                    className="w-full bg-surface-container-highest border border-white/10 rounded-lg px-4 py-2.5 text-body-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none pr-10 chat-scrollbar"
                />
                <button
                    onClick={handleSend}
                    className="absolute right-2 top-2 text-on-surface-variant hover:text-primary transition-colors"
                >
                    <span className="material-symbols-outlined text-[20px]">send</span>
                </button>
            </div>
        </div>
    );
}