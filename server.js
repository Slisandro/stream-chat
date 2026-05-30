const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const dataDir = process.env.DATABASE_PATH || '/app/data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`📁 Directorio de datos creado: ${dataDir}`);
}

const dbPath = path.join(dataDir, 'chat.db');
console.log(`🗄️ Base de datos: ${dbPath}`);

const db = new sqlite3.Database(dbPath);

db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name TEXT NOT NULL,
    user_color TEXT NOT NULL,
    user_badges TEXT,
    text TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    system INTEGER DEFAULT 0
  )
`);

app.prepare().then(async () => { 
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

  const loadMessages = () => {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM messages 
        ORDER BY timestamp ASC 
        LIMIT 100
      `, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const messages = rows.map(row => ({
          id: row.id,
          user: {
            name: row.user_name,
            color: row.user_color,
            badges: JSON.parse(row.user_badges || '[]')
          },
          text: row.text,
          timestamp: new Date(row.timestamp),
          system: row.system === 1
        }));

        resolve(messages);
      });
    });
  };

  const messages = await loadMessages();

  const saveMessage = (message) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO messages (user_name, user_color, user_badges, text, timestamp, system)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        message.user.name,
        message.user.color,
        JSON.stringify(message.user.badges || []),
        message.text,
        message.timestamp.getTime(),
        message.system ? 1 : 0,
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
      stmt.finalize();
    });
  };

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

    socket.on('user-join', async (username) => { 
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
      await saveMessage(welcomeMessage);
      io.emit('chat-message', welcomeMessage);
    });

    socket.on('chat-message', async (data) => {
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

        await saveMessage(message);
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

    socket.on('disconnect', async () => {
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
        await saveMessage(leaveMessage);
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