
import { Request, Response } from "express";
import pool from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";


export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name }  = req.body;
    console.log(email, password, name);
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existingUser = await pool.query('SELECT id FROM "User" WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO "User" (id, email, password, name, "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW()) RETURNING id',
      [email, hashedPassword, name]
    );

    const userid = result.rows[0].id;
    return res.status(201).json({
      message: "user created successfully",
      userId: userid
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query('SELECT * FROM "User" WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials user not found' });
    }

    const user = result.rows[0];

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials password wrong' });
    }

    const token = jwt.sign({
      id: user.id,
    }, process.env.JWT_SECRET!, {
      expiresIn: '30d'
    });

    res.json({
      message: "logged in successfully",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}