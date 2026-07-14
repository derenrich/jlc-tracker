import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import Home from './pages/Home';
import PartPage from './pages/Part';

// Normalizes /p/1002 or /p/c1002 to /p/C1002 so history docs and shared links
// agree on one canonical URL per part.
function CanonicalPart() {
  const { code = '' } = useParams();
  const canonical = /^C\d+$/.test(code) ? code : `C${code.replace(/^c/i, '')}`;
  if (!/^C\d+$/.test(canonical)) return <Navigate to="/" replace />;
  if (canonical !== code) return <Navigate to={`/p/${canonical}`} replace />;
  return <PartPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/p/:code" element={<CanonicalPart />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
