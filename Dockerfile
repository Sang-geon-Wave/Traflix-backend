FROM node:18

WORKDIR /app
COPY traflix-backend/package*.json ./
RUN npm install

COPY traflix-backend/ .

EXPOSE 8080

CMD npm run dev