import '../styles/globals.css';
import { FrostLayout } from '../components/frost/FrostLayout';

export default function App({ Component, pageProps }) {
  return (
    <FrostLayout>
      <Component {...pageProps} />
    </FrostLayout>
  );
}
