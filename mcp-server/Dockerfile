FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev=false
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
ENV NODE_ENV=production
# In een container is er geen stdio-client: altijd als HTTP-server draaien,
# anders start hij op stdio en luistert er niets op de poort.
ENV MCP_HTTP_MODE=true
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:${MCP_PORT:-3001}/health || exit 1
CMD ["node", "build/index.js"]
