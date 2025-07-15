import { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('access_token') || '');
  const [profile, setProfile] = useState(null);
  const [postText, setPostText] = useState('');
  const [message, setMessage] = useState('');

  const login = () => {
    const client_id =1104549454856069;
    const redirect_uri = 'https://threads-1rpq.vercel.app/api/auth/callbacks';
    const scope = 'threads_basic,threads_content_publish';
    const url = `https://www.instagram.com/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&scope=${scope}&response_type=code`;
    window.location.href = url;
  };

  const fetchProfile = async () => {
    const res = await axios.get(`${API}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setProfile(res.data);
  };

  const sendPost = async () => {
    const res = await axios.post(`${API}/post`, { message: postText }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setMessage('Posted successfully!');
  };

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code && !token) {
      axios
        .get(`${API}/auth/callback?code=${code}`)
        .then(res => {
          localStorage.setItem('access_token', res.data.token);
          setToken(res.data.token);
          window.history.replaceState(null, '', '/');
        });
    }
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>Threads Auto Poster</h1>

      {!token ? (
        <button onClick={login}>Login with Threads</button>
      ) : (
        <>
          <button onClick={fetchProfile}>Fetch Profile</button>
          {profile && (
            <div>
              <h3>Welcome, {profile.username}</h3>
              <img src={profile.profile_picture_url} alt="profile" width={80} />
            </div>
          )}
          <textarea
            rows={4}
            placeholder="Write your Threads post here"
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            style={{ width: '100%', marginTop: 20 }}
          />
          <button onClick={sendPost} style={{ marginTop: 10 }}>Post to Threads</button>

          {message && <p style={{ color: 'green' }}>{message}</p>}
        </>
      )}
    </div>
  );
}

export default App;
