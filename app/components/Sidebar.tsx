"use client";

import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface User {
    id: string;
    name: string;
    color: string;
    badges: string[];
}

interface SidebarProps {
    socket: Socket;
    currentUser: string;
}

export default function Sidebar({ socket, currentUser }: SidebarProps) {
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        socket.on('users-list', (usersList: User[]) => {
            setUsers(usersList);
        });

        socket.on('user-joined', (user: User) => {
            console.log(`${user.name} se unió`);
        });

        socket.on('user-left', (userName: string) => {
            console.log(`${userName} salió`);
        });

        return () => {
            socket.off('users-list');
            socket.off('user-joined');
            socket.off('user-left');
        };
    }, [socket]);

    return (
        <aside className="bg-surface-container-lowest w-64 border-r border-white/5 flex flex-col">
            <div className="p-4 border-b border-white/5">
                <h2 className="text-label-bold font-label-bold text-on-surface">Usuarios Conectados</h2>
                <p className="text-[10px] text-primary">{users.length} {users.length === 1 ? 'usuario' : 'usuarios'}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {users.map((user) => (
                    <div
                        key={user.id}
                        className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-all duration-200 ${user.name === currentUser ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-surface-container-high'
                            }`}
                    >
                        <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary-container flex items-center justify-center">
                                <span className="text-on-primary font-bold text-sm">
                                    {user.name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-surface-container-lowest"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${user.name === currentUser ? 'text-primary' : 'text-on-surface'}`}>
                                {user.name}
                                {user.name === currentUser && <span className="text-[10px] ml-1 text-on-surface-variant">(tú)</span>}
                            </p>
                            <div className="flex gap-1 mt-0.5">
                                {user.badges?.includes('verified_user') && (
                                    <span className="material-symbols-outlined text-green-500 text-[12px]">verified_user</span>
                                )}
                                {user.badges?.includes('star') && (
                                    <span className="material-symbols-outlined text-primary text-[12px]">star</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </aside>
    );
}