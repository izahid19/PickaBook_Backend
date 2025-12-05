require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./database/db');

// Import routes
const authRoutes = require('./routes/auth');
const generateRoutes = require('./routes/generate');

const app = express();
const port = process.env.PORT || 8000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/generate', generateRoutes);

app.get('/', (req, res) => {
  res.send('Pickabook Backend is running');
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
