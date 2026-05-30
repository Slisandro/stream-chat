FROM node:20-alpine

# Instalar build tools para sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

# Configurar npm para permitir builds
RUN npm config set ignore-scripts false

# Instalar dependencias
RUN npm install --build-from-source

# Copiar el resto
COPY . .

RUN mkdir -p app pages

EXPOSE 8080

CMD ["node", "server.js"]