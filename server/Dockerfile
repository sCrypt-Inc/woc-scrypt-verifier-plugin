FROM node:19.7.0-bullseye

WORKDIR /app
COPY . .

RUN apt-get update && apt-get install -y \
  curl \
  && rm -rf /var/lib/apt/lists/*
RUN npm ci 
RUN npm run build
RUN curl -Ls https://scrypt.io/setup | sh -s -- -f

ENV NODE_ENV production
EXPOSE 3000

CMD [ "npm", "run", "start" ]