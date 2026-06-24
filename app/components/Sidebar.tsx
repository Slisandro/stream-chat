"use client";

import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Menu, X, Users, LogOut } from 'lucide-react'; // Asegúrate de tener lucide-react instalado

interface User {
    id: string;
    name: string;
    color: string;
    badges: string[];
}

interface SidebarProps {
    socket: Socket;
    currentUser: string;
    onLogout: () => void;
}

export default function Sidebar({ socket, currentUser, onLogout }: SidebarProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const onUsersList = (usersList: User[]) => setUsers(usersList);
        const onUserJoined = (user: User) => console.log(`${user.name} se unió`);
        const onUserLeft = (userName: string) => console.log(`${userName} salió`);

        socket.on('users-list', onUsersList);
        socket.on('user-joined', onUserJoined);
        socket.on('user-left', onUserLeft);

        return () => {
            socket.off('users-list', onUsersList);
            socket.off('user-joined', onUserJoined);
            socket.off('user-left', onUserLeft);
        };
    }, [socket]);

    // Cerrar sidebar al hacer click fuera en móvil
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 640) {
                setIsOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <>
            {/* Botón flotante para abrir/cerrar en móvil */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    sm:hidden fixed z-50 transition-all duration-300
                    ${isOpen ? 'top-4 right-4' : 'bottom-4 left-4'}
                    bg-primary text-on-primary p-3 rounded-full shadow-lg hover:brightness-110
                `}
                aria-label={isOpen ? 'Cerrar sidebar' : 'Abrir sidebar'}
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Overlay para móvil */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 sm:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed sm:relative inset-y-0 left-0 z-40
                    w-72 sm:w-64 
                    bg-surface-container-lowest sm:bg-surface-container-lowest
                    border-r border-white/5
                    flex flex-col
                    transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
                    shadow-2xl sm:shadow-none
                `}
            >
                {/* Header con contador de usuarios */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="text-label-bold font-label-bold text-on-surface flex items-center gap-2">
                            <Users size={18} className="text-primary" />
                            Usuarios Conectados
                        </h2>
                        <p className="text-[10px] text-primary">
                            {users.length} {users.length === 1 ? 'usuario' : 'usuarios'}
                        </p>
                    </div>
                    
                    {/* Botón cerrar en móvil dentro del sidebar */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="sm:hidden text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-white/5 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Lista de usuarios - Scrolleable */}
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {users.length === 0 ? (
                        <div className="text-center text-on-surface-variant text-body-sm py-8">
                            No hay usuarios conectados
                        </div>
                    ) : (
                        users.map((user) => (
                            <div
                                key={user.id}
                                className={`
                                    flex items-center gap-3 px-2 py-2 rounded-lg transition-all duration-200
                                    ${user.name === currentUser 
                                        ? 'bg-primary/10 border-l-2 border-primary' 
                                        : 'hover:bg-surface-container-high'
                                    }
                                    cursor-default
                                `}
                            >
                                {/* Avatar */}
                                <div className="relative flex-shrink-0">
                                    <div 
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-on-primary font-bold text-sm"
                                        style={{
                                            background: user.color || `hsl(${Math.random() * 360}, 70%, 50%)`
                                        }}
                                    >
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-surface-container-lowest"></div>
                                </div>

                                {/* Nombre y badges */}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${user.name === currentUser ? 'text-primary' : 'text-on-surface'}`}>
                                        {user.name}
                                        {user.name === currentUser && (
                                            <span className="text-[10px] ml-1 text-on-surface-variant font-normal">
                                                (tú)
                                            </span>
                                        )}
                                    </p>
                                    <div className="flex gap-1 mt-0.5">
                                        {user.badges?.includes('verified_user') && (
                                            <span className="text-green-500 text-[12px]">✅</span>
                                        )}
                                        {user.badges?.includes('star') && (
                                            <span className="text-primary text-[12px]">⭐</span>
                                        )}
                                    </div>
                                </div>

                                {/* Indicador de usuario actual en móvil */}
                                {user.name === currentUser && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 hidden sm:block"></div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Botón de logout */}
                <div className="p-3 border-t border-white/5 flex-shrink-0">
                    <button
                        onClick={() => {
                            onLogout();
                            setIsOpen(false); // Cerrar sidebar al hacer logout en móvil
                        }}
                        className="
                            w-full 
                            text-on-surface-variant hover:text-error 
                            text-body-sm 
                            border border-white/10 hover:border-error/30
                            rounded-lg px-3 py-2.5 
                            transition-all duration-200
                            flex items-center justify-center gap-2
                            hover:bg-error/5
                        "
                    >
                        <LogOut size={16} />
                        <span>Salir del chat</span>
                    </button>
                </div>
            </aside>
        </>
    );
}