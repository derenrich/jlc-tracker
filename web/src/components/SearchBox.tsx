import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractPartCode } from '../lib/parse';

interface Props {
  large?: boolean;
  autoFocus?: boolean;
}

export default function SearchBox({ large, autoFocus }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = extractPartCode(value);
    if (!code) {
      setError('Enter a part number like C1002, or paste an LCSC / JLCPCB product URL.');
      return;
    }
    setError(null);
    setValue('');
    navigate(`/p/${code}`);
  }

  return (
    <form className={large ? 'search search-large' : 'search'} onSubmit={onSubmit}>
      <div className="search-row">
        <input
          type="text"
          value={value}
          autoFocus={autoFocus}
          spellCheck={false}
          placeholder="Part number or LCSC / JLCPCB URL"
          aria-label="part number or product URL"
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        <button type="submit">Look up</button>
      </div>
      {error && <p className="search-error">{error}</p>}
    </form>
  );
}
