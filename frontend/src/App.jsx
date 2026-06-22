import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import LoginPage from './pages/LoginPage';
import MainPage from './pages/MainPage';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', paddingTop: '100px' }}>로딩중...</div>;

  return session ? <MainPage /> : <LoginPage />;
}
