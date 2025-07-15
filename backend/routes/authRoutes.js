import express from 'express';
import axios from 'axios';
import multer from 'multer';
import fs from 'fs';
import FormData from 'form-data';

const router = express.Router();

const storage = multer.memoryStorage();

const upload = multer({
  storage, // ← ✅ No disk writes
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and GIF are allowed.'));
    }
  },
});


const authenticateToken = async (req, res, next) => {
  const token = req.headers['x-access-token'];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const response = await axios.get(
      `https://graph.threads.net/v1.0/me?fields=id&access_token=${token}`
    );
    req.user = { access_token: token, id: response.data.id };
    next();
  } catch (err) {
    console.error('Token validation error:', err.message);
    res.status(401).json({ message: 'Invalid token' });
  }
};

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { access_token } = req.user;
    const { data } = await axios.get(
      `https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url,threads_biography&access_token=${access_token}`
    );
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch profile:', err.response?.data || err.message);
    res.status(500).json({ message: 'Could not retrieve Threads profile' });
  }
});

router.post('/instagram', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ message: 'Authorization code missing' });

  try {
    const tokenResponse = await axios.post(
      'https://api.instagram.com/oauth/access_token',
      null,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        params: {
          client_id: process.env.THREADS_CLIENT_ID,
          client_secret: process.env.THREADS_CLIENT_SECRET,
          grant_type: 'authorization_code',
          redirect_uri: process.env.REDIRECT_URI,
          code,
        },
      }
    );

    const { access_token, user_id } = tokenResponse.data;
    const userInfoResponse = await axios.get(
      `https://graph.threads.net/v1.0/${user_id}?fields=id,username&access_token=${access_token}`
    );

    const user = {
      id: userInfoResponse.data.id,
      username: userInfoResponse.data.username,
    };

    res.json({ access_token, user });
  } catch (err) {
    console.error('OAuth Error:', err?.response?.data || err.message);
    res.status(500).json({ message: 'Threads login failed' });
  }
});

router.post('/post', authenticateToken, upload.single('image'), async (req, res) => {
  const caption = req.body.caption || '';
  if (caption.length > 500) {
    return res.status(400).json({ message: 'Caption exceeds maximum length of 500 characters' });
  }
  const image = req.file;
  const accessToken = req.user.access_token;
  const userId = req.user.id;

  try {
    let creationId;
    if (image) {
      const imageBuffer = fs.readFileSync(image.path);
      const form = new FormData();
      form.append('image', imageBuffer, {
        filename: image.originalname,
        contentType: image.mimetype,
      });
      form.append('media_type', 'IMAGE');
      form.append('caption', caption);
      form.append('access_token', accessToken);

      const uploadResponse = await axios.post(
        `https://graph.threads.net/v1.0/${userId}/media`,
        form,
        { headers: form.getHeaders() }
      );

      creationId = uploadResponse.data.id;
    } else {
      const createRes = await axios.post(
        `https://graph.threads.net/v1.0/${userId}/threads`,
        null,
        {
          params: {
            media_type: 'TEXT',
            text: caption,
            access_token: accessToken,
          },
        }
      );
      creationId = createRes.data.id;
    }

    const publishRes = await axios.post(
      `https://graph.threads.net/v1.0/${userId}/threads_publish`,
      null,
      {
        params: {
          creation_id: creationId,
          access_token: accessToken,
        },
      }
    );

    res.status(200).json({
      message: 'Thread posted successfully!',
      thread_id: publishRes.data.id,
    });
  } catch (err) {
    const errorMessage = err.response?.data?.error?.message || err.message;
    console.error('Threads post error:', {
      message: errorMessage,
      status: err.response?.status,
      data: err.response?.data,
    });
    if (err.response?.status === 429) {
      res.status(429).json({ message: 'API rate limit exceeded. Try again later.' });
    } else {
      res.status(500).json({ message: `Failed to post to Threads: ${errorMessage}` });
    }
  } finally {
    if (image && fs.existsSync(image.path)) {
      try {
        fs.unlinkSync(image.path);
      } catch (err) {
        console.error('Failed to delete file:', err);
      }
    }
  }
});

router.get('/refresh-token', async (req, res) => {
  const token = req.headers['x-access-token'];
  if (!token) return res.status(400).json({ message: 'No token provided' });
  try {
    const { data } = await axios.get('https://graph.instagram.com/refresh_access_token', {
      params: {
        grant_type: 'ig_refresh_token',
        access_token: token,
      },
    });
    res.json({ access_token: data.access_token });
  } catch (err) {
    console.error('Token refresh error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Failed to refresh token' });
  }
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  try {
    const tokenResponse = await axios.post(
      'https://api.instagram.com/oauth/access_token',
      null,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        params: {
          client_id: process.env.THREADS_CLIENT_ID,
          client_secret: process.env.THREADS_CLIENT_SECRET,
          grant_type: 'authorization_code',
          redirect_uri: process.env.REDIRECT_URI,
          code,
        },
      }
    );

    const { access_token, user_id } = tokenResponse.data;
    const userInfoResponse = await axios.get(
      `https://graph.threads.net/v1.0/${user_id}?fields=id,username&access_token=${access_token}`
    );

    res.redirect(`http://localhost:5173/?token=${access_token}&user=${userInfoResponse.data.username}`);
  } catch (err) {
    console.error('Callback error:', err.response?.data || err.message);
    res.status(500).send('Threads login failed');
  }
});

export default router;