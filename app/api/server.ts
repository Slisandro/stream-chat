import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

interface User {
    id: string;
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

app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url || '', true);
        handle(req, res, parsedUrl);
    });

    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Almacenar usuarios en memoria
    const users = new Map<string, User>();
    const messages: Message[] = [];

    const getRandomColor = (): string => {
        const colors = ['#1E90FF', '#FF4500', '#00FF7F', '#DA70D6', '#FFD700', '#FF69B4', '#00CED1'];
        return colors[Math.floor(Math.random() * colors.length)];
    };

    const getRandomBadges = (): string[] => {
        const badges: string[] = [];
        if (Math.random() > 0.7) badges.push('star');
        if (Math.random() > 0.9) badges.push('verified_user');
        return badges;
    };

    io.on('connection', (socket) => {
        console.log('Usuario conectado:', socket.id);

        // Enviar historial de mensajes al nuevo usuario
        socket.emit('chat-history', messages);

        // Enviar lista de usuarios actuales
        io.emit('users-list', Array.from(users.values()));

        // Unirse al chat con un nombre
        socket.on('user-join', (username: string) => {
            const user: User = {
                id: socket.id,
                name: username,
                color: getRandomColor(),
                badges: getRandomBadges()
            };

            users.set(socket.id, user);

            // Notificar a todos que un nuevo usuario se unió
            io.emit('user-joined', user);
            io.emit('users-list', Array.from(users.values()));

            // Enviar mensaje de bienvenida
            const welcomeMessage: Message = {
                id: Date.now(),
                user: { name: 'Sistema', color: '#d5baff', badges: ['verified_user'] },
                text: `${username} se unió al chat`,
                timestamp: new Date(),
                system: true
            };
            messages.push(welcomeMessage);
            io.emit('chat-message', welcomeMessage);
        });

        // Manejar mensajes de chat
        socket.on('chat-message', (data: { text: string }) => {
            const user = users.get(socket.id);
            if (user && data.text.trim()) {
                const message: Message = {
                    id: Date.now(),
                    user: user,
                    text: data.text,
                    timestamp: new Date()
                };
                messages.push(message);
                // Mantener solo los últimos 100 mensajes
                if (messages.length > 100) messages.shift();
                io.emit('chat-message', message);
            }
        });

        // Manejar escritura
        socket.on('typing', (isTyping: boolean) => {
            const user = users.get(socket.id);
            if (user) {
                socket.broadcast.emit('user-typing', {
                    user: user.name,
                    isTyping
                });
            }
        });

        // Desconexión
        socket.on('disconnect', () => {
            const user = users.get(socket.id);
            if (user) {
                users.delete(socket.id);
                io.emit('user-left', user.name);
                io.emit('users-list', Array.from(users.values()));

                const leaveMessage: Message = {
                    id: Date.now(),
                    user: { name: 'Sistema', color: '#d5baff', badges: ['verified_user'] },
                    text: `${user.name} salió del chat`,
                    timestamp: new Date(),
                    system: true
                };
                messages.push(leaveMessage);
                io.emit('chat-message', leaveMessage);
            }
            console.log('Usuario desconectado:', socket.id);
        });
    });

    const PORT = process.env.PORT || 3000;

    server.listen(PORT, (err?: Error) => {
        if (err) throw err;
        console.log(`> Servidor corriendo en http://localhost:${PORT}`);
    });
});