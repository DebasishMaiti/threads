// /backend/index.js
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
} = process.env;

// Exchange code for token
app.get('/api/auth/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const result = await axios.post(`https://api.instagram.com/oauth/access_token`, null, {
      params: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code
      }
    });

    res.json({ token: result.data.access_token });
  } catch (error) {
    res.status(500).json({ error: error.response?.data || 'Token exchange failed' });
  }
});

// Fetch Threads profile
app.get('/api/profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });

  try {
    const profile = await axios.get(
      `https://graph.threads.net/v1.0/me?fields=id,username,profile_picture_url`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json(profile.data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || 'Failed to fetch profile' });
  }
});

// Post to Threads
app.post('/api/post', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { message } = req.body;
  if (!token || !message) return res.status(400).json({ error: 'Missing fields' });

  try {
    const post = await axios.post(
      `https://graph.threads.net/v1.0/me/threads`,
      { message },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json(post.data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || 'Failed to post' });
  }
});

app.listen(5000, () => console.log('Backend running on http://localhost:5000'));
