"use client";

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

interface ChatMessageProps {
    message: Message;
    currentUser: string;
}

export default function ChatMessage({ message, currentUser }: ChatMessageProps) {
    const isSystem = message.system;
    const isOwnMessage = !isSystem && message.user && 'name' in message.user && message.user.name === currentUser;

    if (isSystem) {
        return (
            <div className="text-center py-1 px-2">
                <span className="text-on-surface-variant text-xs bg-surface-container-high px-2 py-0.5 rounded">
                    {message.text}
                </span>
            </div>
        );
    }

    const user = message.user as User;

    return (
        <div className={`flex items-start gap-1.5 px-2 py-1 hover:bg-surface-container-high transition-colors group ${isOwnMessage ? 'bg-primary/5' : ''}`}>
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
                {user.badges?.includes('verified_user') && (
                    <span className="material-symbols-outlined text-green-500 text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        verified_user
                    </span>
                )}
                {user.badges?.includes('star') && (
                    <span className="material-symbols-outlined text-primary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        star
                    </span>
                )}
            </div>
            <div className="text-chat-text font-chat-text break-words flex-1">
                <span className="font-bold cursor-pointer hover:underline" style={{ color: user.color }}>
                    {user.name}:
                </span>
                <span className="text-on-background/90 ml-1">{message.text}</span>
            </div>
            <span className="text-on-surface-variant text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
    );
}