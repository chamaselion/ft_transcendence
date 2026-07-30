import { useState } from 'react';

const API_BASE = 'http://localhost:3001';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export default function App() {
  const [registerForm, setRegisterForm] = useState({
    login: '',
    email: '',
    password: '',
  });

  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });

  const [confirmForm, setConfirmForm] = useState({
    challengeId: '',
    email: '',
    code: '',
  });

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [challengeInfo, setChallengeInfo] = useState(null);
  const [profile, setProfile] = useState(null);

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const data = await request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerForm),
      });
      setMessage(`Registered: ${JSON.stringify(data)}`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const data = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      });

      setChallengeInfo(data);
      setConfirmForm((prev) => ({
        ...prev,
        challengeId: data.challengeId || '',
        email: data.email || '',
      }));

      setMessage(`Login challenge sent. Check debug code in backend console.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const data = await request('/api/auth/login/confirm', {
        method: 'POST',
        body: JSON.stringify(confirmForm),
      });

      setMessage(`Logged in: ${JSON.stringify(data)}`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadProfile() {
    setLoading(true);
    setMessage('');
    try {
      const data = await request('/api/auth/me');
      setProfile(data);
      setMessage('Profile loaded');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <h1>Transcendence Auth Demo</h1>
      <p>Frontend talks to backend on http://localhost:3001</p>

      {message && <div className="message">{message}</div>}

      <div className="grid">
        <section className="card">
          <h2>Register</h2>
          <form onSubmit={handleRegister}>
            <input
              placeholder="Login"
              value={registerForm.login}
              onChange={(e) =>
                setRegisterForm({ ...registerForm, login: e.target.value })
              }
            />
            <input
              placeholder="Email"
              value={registerForm.email}
              onChange={(e) =>
                setRegisterForm({ ...registerForm, email: e.target.value })
              }
            />
            <input
              type="password"
              placeholder="Password"
              value={registerForm.password}
              onChange={(e) =>
                setRegisterForm({ ...registerForm, password: e.target.value })
              }
            />
            <button disabled={loading}>Register</button>
          </form>
        </section>

        <section className="card">
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <input
              placeholder="Email"
              value={loginForm.email}
              onChange={(e) =>
                setLoginForm({ ...loginForm, email: e.target.value })
              }
            />
            <input
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm({ ...loginForm, password: e.target.value })
              }
            />
            <button disabled={loading}>Send code</button>
          </form>

          {challengeInfo && (
            <div className="hint">
              <p>Challenge ID: {challengeInfo.challengeId}</p>
              <p>Code length: {challengeInfo.codeLength}</p>
              <p>Debug code: {challengeInfo.debugCode}</p>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Confirm 2FA</h2>
          <form onSubmit={handleConfirm}>
            <input
              placeholder="Challenge ID"
              value={confirmForm.challengeId}
              onChange={(e) =>
                setConfirmForm({ ...confirmForm, challengeId: e.target.value })
              }
            />
            <input
              placeholder="Email"
              value={confirmForm.email}
              onChange={(e) =>
                setConfirmForm({ ...confirmForm, email: e.target.value })
              }
            />
            <input
              placeholder="Code"
              value={confirmForm.code}
              onChange={(e) =>
                setConfirmForm({ ...confirmForm, code: e.target.value })
              }
            />
            <button disabled={loading}>Confirm</button>
          </form>
        </section>

        <section className="card">
          <h2>Profile</h2>
          <button onClick={handleLoadProfile} disabled={loading}>
            Load profile
          </button>
          {profile && (
            <pre>{JSON.stringify(profile, null, 2)}</pre>
          )}
        </section>
      </div>
    </div>
  );
}