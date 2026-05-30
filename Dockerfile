FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Usar npm en lugar de pnpm
RUN npm install --omit=dev || npm install

COPY . .

# Crear carpetas necesarias
RUN mkdir -p app pages

EXPOSE 8080

CMD ["node", "server.js"]