FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Use npm install instead of npm ci to avoid lockfile issues
RUN npm install --omit=dev

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Start the application
CMD ["npm", "start"]
