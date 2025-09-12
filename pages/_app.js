// pages/_app.js
import '../styles/globals.css';
import { useEffect } from 'react';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    document.body.classList.add('piedmont');
  }, []);
  return <Component {...pageProps} />;
}
