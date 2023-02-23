FROM node:19.7.0-bullseye

WORKDIR /app
COPY . .

RUN npm ci 
RUN npm run build

EXPOSE 8080

CMD [ "npm", "run", "start" ]