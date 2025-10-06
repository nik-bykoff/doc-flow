FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .

RUN chmod +x /usr/src/app/entrypoint.sh

EXPOSE 5173

CMD ["/bin/sh", "/usr/src/app/entrypoint.sh"]


