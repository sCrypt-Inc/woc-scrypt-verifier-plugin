FROM node:19-bullseye

WORKDIR /app
COPY . .

RUN apt-get update && apt-get install -y \
  curl \
  &&  curl -sSL https://get.docker.com/ | sh \
  && rm -rf /var/lib/apt/lists/*
RUN npm i
RUN npm run build
RUN ./scryptc-setup.sh -f

#ENV NODE_ENV production
#EXPOSE 5001

CMD [ "npm", "run", "start" ]
