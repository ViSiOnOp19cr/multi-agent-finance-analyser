import {Pool} from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: './src/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

export default pool;