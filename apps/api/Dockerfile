FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
# docker-cli: PDF export runs the texlive image via the host dockerd (socket mounted in compose).
RUN apk add --no-cache docker-cli
COPY . .
EXPOSE 4000
CMD ["npm", "start"]
