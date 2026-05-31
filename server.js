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

const db = new sqlite3.Database(dbPath, (error) => {
  if (error) {
    console.error('Error abriendo SQLite:', error);
  }
});

const initDatabase = () => new Promise((resolve, reject) => {
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
  `, (error) => {
    if (error) {
      reject(error);
      return;
    }
    resolve();
  });
});

// ========== CONFIGURACIÓN ANTI-SPAM ==========
const spamConfig = {
  messageLimit: 1,        // Máximo de mensajes
  timeWindow: 10000,      // En 10 segundos
  cooldown: 10000,         // Esperar 10 segundos entre mensajes
  maxLength: 100,         // Máximo caracteres por mensaje
  minLength: 1,           // Mínimo caracteres
  duplicateTimeout: 30000, // No repetir mismo mensaje por 30 segundos
  maxCapsRatio: 0.7,      // Máximo 70% de mayúsculas
  maxRepeats: 5,          // Máximo de caracteres repetidos seguidos
};

// Lista de palabras ofensivas (puedes expandirla)
const badWords = [
  'puta', 'puto', 'coño', 'joder', 'mierda', 'cabrón', 'cabron',
  'gilipollas', 'imbécil', 'imbecil', 'estúpido', 'estupido', 'idiota',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'cunt', 'whore', 'slut'
];

// Normalizar texto para detectar evasiones
const normalizeText = (text) => {
  return text
    .toLowerCase()
    .replace(/[0-9]/g, '')           // Eliminar números
    .replace(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g, '') // Eliminar puntuación
    .replace(/[áä]/g, 'a')
    .replace(/[éë]/g, 'e')
    .replace(/[íï]/g, 'i')
    .replace(/[óö]/g, 'o')
    .replace(/[úü]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/(.)\1{2,}/g, '$1$1');  // Reducir repeticiones excesivas
};

// Detectar lenguaje ofensivo
const containsBadWord = (text) => {
  const normalized = normalizeText(text);
  for (const badWord of badWords) {
    if (normalized.includes(badWord)) {
      return true;
    }
  }
  return false;
};

// Detectar exceso de mayúsculas
const hasTooManyCaps = (text) => {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length === 0) return false;
  const caps = (text.match(/[A-Z]/g) || []).length;
  return caps / letters.length > spamConfig.maxCapsRatio;
};

// Detectar caracteres repetidos excesivos
const hasExcessiveRepeats = (text) => {
  return /(.)\1{${spamConfig.maxRepeats},}/.test(text);
};

// Almacenar historial de mensajes por usuario
const userMessageHistory = new Map(); // userId -> { timestamps, lastMessage, lastMessageTime, warnings }

const checkSpam = (userId, message, userName) => {
  const now = Date.now();
  const history = userMessageHistory.get(userId) || {
    timestamps: [],
    lastMessage: '',
    lastMessageTime: 0,
    warnings: 0
  };

  // Limpiar timestamps antiguos
  const recentTimestamps = history.timestamps.filter(t => now - t < spamConfig.timeWindow);
  recentTimestamps.push(now);

  // 1. Verificar límite de mensajes por tiempo
  if (recentTimestamps.length > spamConfig.messageLimit) {
    return { isSpam: true, reason: `⚠️ Demasiados mensajes. Espera unos segundos. (Máximo ${spamConfig.messageLimit} mensajes en ${spamConfig.timeWindow / 1000} segundos)` };
  }

  // 2. Verificar cooldown entre mensajes
  if (history.lastMessageTime && (now - history.lastMessageTime) < spamConfig.cooldown) {
    const waitTime = Math.ceil((spamConfig.cooldown - (now - history.lastMessageTime)) / 1000);
    return { isSpam: true, reason: `⚠️ Por favor espera ${waitTime} segundo${waitTime !== 1 ? 's' : ''} antes de enviar otro mensaje.` };
  }

  // 3. Verificar mensaje duplicado
  if (message === history.lastMessage && (now - history.lastMessageTime) < spamConfig.duplicateTimeout) {
    return { isSpam: true, reason: '⚠️ No repitas el mismo mensaje tan rápido.' };
  }

  // 4. Verificar longitud
  if (message.length > spamConfig.maxLength) {
    return { isSpam: true, reason: `⚠️ Mensaje demasiado largo (máximo ${spamConfig.maxLength} caracteres).` };
  }

  if (message.length < spamConfig.minLength) {
    return { isSpam: true, reason: '⚠️ Mensaje demasiado corto.' };
  }

  // 5. Verificar lenguaje ofensivo
  if (containsBadWord(message)) {
    return { isSpam: true, reason: '⚠️ El mensaje contiene lenguaje inapropiado.', isOffensive: true };
  }

  // 6. Verificar exceso de mayúsculas (gritos)
  if (hasTooManyCaps(message)) {
    return { isSpam: true, reason: '⚠️ Por favor, no grites. Evita el uso excesivo de mayúsculas.' };
  }

  // 7. Verificar caracteres repetidos excesivos
  if (hasExcessiveRepeats(message)) {
    return { isSpam: true, reason: '⚠️ Evita repetir caracteres excesivamente.' };
  }

  // Actualizar historial
  userMessageHistory.set(userId, {
    timestamps: recentTimestamps,
    lastMessage: message,
    lastMessageTime: now,
    warnings: history.warnings
  });

  return { isSpam: false };
};

// Limpiar historial periódicamente (cada hora)
setInterval(() => {
  const now = Date.now();
  for (const [userId, history] of userMessageHistory.entries()) {
    const recentTimestamps = history.timestamps.filter(t => now - t < spamConfig.timeWindow);
    if (recentTimestamps.length === 0 && history.warnings === 0) {
      userMessageHistory.delete(userId);
    } else {
      userMessageHistory.set(userId, { ...history, timestamps: recentTimestamps });
    }
  }
}, 3600000);

// ========== FIN CONFIGURACIÓN ANTI-SPAM ==========

app.prepare().then(async () => {
  await initDatabase();

  const server = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket'],
  });

  const users = new Map();

  const loadMessages = () => {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT *
        FROM (
          SELECT * FROM messages
          ORDER BY timestamp DESC
          LIMIT 100
        ) recent_messages
        ORDER BY timestamp ASC
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

    io.emit('users-list', Array.from(users.values()));

    socket.on('request-chat-history', async () => {
      try {
        const latestMessages = await loadMessages();
        socket.emit('chat-history', latestMessages);
      } catch (error) {
        console.error('No se pudo cargar el historial del chat:', error);
      }
    });

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
      try {
        await saveMessage(welcomeMessage);
      } catch (error) {
        console.error('No se pudo guardar el mensaje de bienvenida:', error);
      }
      io.emit('chat-message', welcomeMessage);
    });

    socket.on('chat-message', async (data) => {
      const user = users.get(socket.id);
      if (user && data.text.trim()) {

        const messageText = data.text.trim();

        if (messageText.startsWith('/')) {
          const [command, ...args] = messageText.slice(1).split(' ');
          const argument = args.join(' ');

          switch (command.toLowerCase()) {
            case 'users':
              const userList = Array.from(users.values()).map(u => u.name);
              const userCount = userList.length;
              socket.emit('chat-message', {
                id: Date.now(),
                user: { name: 'Sistema', color: '#d5baff', badges: ['verified_user'] },
                text: `👥 Usuarios conectados (${userCount}): ${userList.join(', ')}`,
                timestamp: new Date(),
                system: true
              });
              break;

            case 'clear':
              socket.emit('clear-chat');
              socket.emit('chat-message', {
                id: Date.now(),
                user: { name: 'Sistema', color: '#d5baff', badges: ['verified_user'] },
                text: '🧹 Chat limpiado localmente',
                timestamp: new Date(),
                system: true
              });
              break;

            case 'me':
              if (argument) {
                // Verificar spam también para acciones /me
                const spamCheck = checkSpam(socket.id, messageText, user.name);
                if (spamCheck.isSpam) {
                  socket.emit('chat-message', {
                    id: Date.now(),
                    user: { name: 'Sistema', color: '#d5baff', badges: ['verified_user'] },
                    text: spamCheck.reason,
                    timestamp: new Date(),
                    system: true
                  });
                  return;
                }

                io.emit('chat-message', {
                  id: Date.now(),
                  user: { name: user.name, color: user.color, badges: user.badges },
                  text: `* ${user.name} ${argument}`,
                  timestamp: new Date(),
                  system: true
                });
              } else {
                socket.emit('chat-message', {
                  id: Date.now(),
                  user: { name: 'Sistema', color: '#d5baff', badges: ['verified_user'] },
                  text: '❌ Uso: /me [acción] - Ejemplo: /me está bailando',
                  timestamp: new Date(),
                  system: true
                });
              }
              break;

            case 'msg':
            case 'private':
            case 'dm':
              if (!argument) {
                socket.emit('chat-message', {
                  id: Date.now(),
                  user: { name: 'Sistema', color: '#d5baff', badges: ['verified_user'] },
                  text: '❌ Uso: /msg [usuario] [mensaje] - Ejemplo: /msg Ana Hola, ¿cómo estás?',
                  timestamp: new Date(),
                  system: true
                });
                return;
              }

              const firstSpace = argument.indexOf(' ');
              if (firstSpace === -1) {
                socket.emit('chat-message', {
                  id: Date.now(),
                  user: { name: 'Sistema', color: '#d5baff', badges: ['verified_user'] },
                  text: '❌ Uso: /msg [usuario] [mensaje] - Ejemplo: /msg Ana Hola, ¿cómo estás?',
                  timestamp: new Date(),
                  system: true
                });
                return;
              }

              const targetUsername = argument.substring(0, firstSpace);
              const privateMessage = argument.substring(firstSpace + 1);

              let targetSocketId = null;
              let targetUser = null;
              for (const [id, u] of users.entries()) {
                if (u.name.toLowerCase() === targetUsername.toLowerCase()) {
                  targetSocketId = id;
                  targetUser = u;
                  break;
                }
              }

              if (!targetSocketId) {
                socket.emit('chat-message', {
                  id: Date.now(),
                  user: { name: 'Sistema', color: '#d5baff', badges: ['verified_user'] },
                  text: `❌ Usuario "${targetUsername}" no encontrado o no está conectado.`,
                  timestamp: new Date(),
                  system: true
                });
                return;
              }

              // Verificar spam también para mensajes privados
              const spamCheck = checkSpam(socket.id, privateMessage, user.name);
              if (spamCheck.isSpam) {
                socket.emit('chat-message', {
                  id: Date.now(),
                  user: { name: 'Sistema', color: '#d5baff', badges: ['verified_user'] },
                  text: spamCheck.reason,
                  timestamp: new Date(),
                  system: true
                });
                return;
              }

              io.to(targetSocketId).emit('private-message', {
                id: Date.now(),
                from: user.name,
                fromColor: user.color,
                text: privateMessage,
                timestamp: new Date(),
                isPrivate: true
              });

              socket.emit('chat-message', {
                id: Date.now(),
                user: { name: 'Sistema', color: '#d5baff', badges: ['verified_user'] },
                text: `💬 Mensaje privado enviado a ${targetUser.name}: "${privateMessage.substring(0, 50)}${privateMessage.length > 50 ? '...' : ''}"`,
                timestamp: new Date(),
                system: true
              });
              break;

            case 'help':
              socket.emit('chat-message', {
                id: Date.now(),
                user: { name: 'Sistema', color: '#d5baff', badges: ['verified_user'] },
                text: `✨ *COMANDOS DISPONIBLES* ✨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 /users       → Ver usuarios conectados
🧹 /clear       → Limpiar tu pantalla
🎭 /me acción   → Acción en tercera persona
💬 /msg usuario mensaje → Mensaje privado
❓ /help        → Mostrar esta ayuda
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Ejemplo: /me está programando en React
📝 Ejemplo: /msg Ana Hola, ¿cómo estás?`,
                timestamp: new Date(),
                system: true
              });
              break;

            default:
              socket.emit('chat-message', {
                id: Date.now(),
                user: { name: 'Sistema', color: '#d5baff', badges: ['verified_user'] },
                text: `❌ Comando desconocido: ${command}. Escribe /help para ver comandos disponibles.`,
                timestamp: new Date(),
                system: true
              });
          }
          return;
        }

        // ========== VERIFICAR SPAM PARA MENSAJES NORMALES ==========
        const spamCheck = checkSpam(socket.id, messageText, user.name);
        if (spamCheck.isSpam) {
          socket.emit('chat-message', {
            id: Date.now(),
            user: { name: 'Sistema', color: '#d5baff', badges: ['verified_user'] },
            text: spamCheck.reason,
            timestamp: new Date(),
            system: true
          });
          return;
        }
        // ========== FIN VERIFICACIÓN SPAM ==========

        // Mensaje normal (no comando)
        const message = {
          id: Date.now(),
          user,
          text: messageText,
          timestamp: new Date(),
        };

        messages.push(message);
        if (messages.length > 100) messages.shift();

        try {
          await saveMessage(message);
        } catch (error) {
          console.error('No se pudo guardar el mensaje:', error);
        }

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
        try {
          await saveMessage(leaveMessage);
        } catch (error) {
          console.error('No se pudo guardar el mensaje de salida:', error);
        }

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