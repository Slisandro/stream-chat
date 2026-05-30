FROM node:20-alpine

# Instalar dependencias para sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY server.js ./
COPY next.config.ts ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código (incluyendo app/, public/, etc.)
COPY . .

# Construir Next.js (esto genera la carpeta .next)
RUN npm run build

# Verificar que .next se creó
RUN ls -la .next/ || echo "⚠️ .next no existe"

# Crear directorio para datos
RUN mkdir -p /app/data

EXPOSE 8080

# Forzar producción
ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "server.js"]