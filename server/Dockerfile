FROM node:19.6.1-buster

WORKDIR /app
COPY . .

RUN apt-get update && apt-get install -y \
  curl \
  && rm -rf /var/lib/apt/lists/*
RUN npm i
RUN npm run build
RUN curl -Ls https://scrypt.io/setup | sh -s -- -f

#ENV NODE_ENV production
#EXPOSE 5001

CMD [ "npm", "run", "start" ]