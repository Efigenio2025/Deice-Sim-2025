// /pages/_app.js
import '../styles/globals.css'; // relative import, no "@/"

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
