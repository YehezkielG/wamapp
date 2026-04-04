import React, { useEffect, useState } from 'react';
import Loading from '../components/Loading';
import { Redirect } from 'expo-router';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) return <Loading message="Loading app..." />;

  return <Redirect href="/(tabs)/dashboard" />;
}
