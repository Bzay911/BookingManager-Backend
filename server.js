import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from "./src/routes/auth.routes.js";
import businessRoutes from "./src/routes/business.routes.js";
import serviceRoutes from "./src/routes/service.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/services', serviceRoutes);

app.get('/', (req, res) => {
  res.send('API running...');
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
})