import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './src/routes/index.js';

dotenv.config({ path: './src/.env' });

const app = express();

app.use(cors());
app.use(express.json());
app.use("/", router);

app.listen(3006, () => {
  console.log("Server running on port 3006");
});