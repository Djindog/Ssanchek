import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const email = `${username.trim()}@ssanchek.com`;
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.box}>
        <div style={styles.logo}>싼책</div>
        <p style={styles.sub}>알라딘 중고책 최적 구매 조합 분석기</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="text"
            placeholder="아이디"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? '처리중...' : isSignUp ? '회원가입' : '로그인'}
          </button>
        </form>

        <button style={styles.toggle} onClick={() => setIsSignUp(v => !v)}>
          {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
  },
  box: {
    background: '#fff',
    border: '1px solid #ddd',
    padding: '40px',
    width: '360px',
    textAlign: 'center',
  },
  logo: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#0066cc',
    marginBottom: '8px',
  },
  sub: {
    fontSize: '13px',
    color: '#666',
    marginBottom: '28px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  input: {
    border: '1px solid #ddd',
    padding: '10px 12px',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
  },
  btn: {
    background: '#0066cc',
    color: '#fff',
    padding: '11px',
    fontSize: '15px',
    fontWeight: 'bold',
    marginTop: '4px',
  },
  error: {
    color: '#e6003e',
    fontSize: '13px',
    textAlign: 'left',
  },
  toggle: {
    background: 'none',
    color: '#0066cc',
    fontSize: '13px',
    marginTop: '16px',
    textDecoration: 'underline',
  },
};
