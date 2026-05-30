const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const users = new Map();
  const messages = [];

  const getRandomColor = () => {
    const colors = ['#1E90FF', '#FF4500', '#00FF7F', '#DA70D6', '#FFD700', '#FF69B4', '#00CED1'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const getRandomBadges = () => {
    const badges = [];
    if (Math.random() > 0.7) badges.push('star');
    if (Math.random() > 0.9) badges.push('verified_user');
    return badges;
  };

  io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    socket.emit('chat-history', messages);
    io.emit('users-list', Array.from(users.values()));

    socket.on('user-join', (username) => {
      const user = {
        id: socket.id,
        name: username,
        color: getRandomColor(),
        badges: getRandomBadges(),
      };

      users.set(socket.id, user);

      io.emit('user-joined', user);
      io.emit('users-list', Array.from(users.values()));

      const welcomeMessage = {
        id: Date.now(),
        user: { name: 'Sistema', color: '#d5baff', badges: ['verified_user'] },
        text: `${username} se unió al chat`,
        timestamp: new Date(),
        system: true,
      };

      messages.push(welcomeMessage);
      io.emit('chat-message', welcomeMessage);
    });

    socket.on('chat-message', (data) => {
      const user = users.get(socket.id);
      if (user && data.text.trim()) {
        const message = {
          id: Date.now(),
          user,
          text: data.text,
          timestamp: new Date(),
        };

        messages.push(message);
        if (messages.length > 100) messages.shift();
        io.emit('chat-message', message);
      }
    });

    socket.on('typing', (isTyping) => {
      const user = users.get(socket.id);
      if (user) {
        socket.broadcast.emit('user-typing', {
          user: user.name,
          isTyping,
        });
      }
    });

    socket.on('disconnect', () => {
      const user = users.get(socket.id);
      if (user) {
        users.delete(socket.id);
        io.emit('user-left', user.name);
        io.emit('users-list', Array.from(users.values()));

        const leaveMessage = {
          id: Date.now(),
          user: { name: 'Sistema', color: '#d5baff', badges: ['verified_user'] },
          text: `${user.name} salió del chat`,
          timestamp: new Date(),
          system: true,
        };

        messages.push(leaveMessage);
        io.emit('chat-message', leaveMessage);
      }

      console.log('Usuario desconectado:', socket.id);
    });
  });

  const port = Number(process.env.PORT || 8080);
  
  server.listen(port, '0.0.0.0', (err) => {  
    if (err) throw err;
    console.log(`> Servidor corriendo en http://0.0.0.0:${port}`); 
  });
});