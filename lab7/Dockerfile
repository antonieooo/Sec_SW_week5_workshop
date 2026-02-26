FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY coffeeserver.js coffee.js tea.js ./

EXPOSE 3000

CMD ["node", "coffeeserver.js"]
