import { useState, useEffect, useRef, useCallback } from 'react';
import './AddressAutocomplete.css';

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [open,        setOpen]        = useState(false);
  const [noResults,   setNoResults]   = useState(false);
  const [apiError,    setApiError]    = useState(false);
  const containerRef  = useRef(null);
  const debounceRef   = useRef(null);

  const search = useCallback(async (query) => {
    if (query.length < 3) {
      setSuggestions([]); setOpen(false); setNoResults(false); setApiError(false);
      return;
    }
    // Append 'India' if no city context detected
    const CITY_KEYWORDS = /bengaluru|bangalore|mumbai|hyderabad|chennai|pune|delhi|gurgaon|noida|thane|ahmedabad|kolkata|kochi|nagpur|indore|jaipur|lucknow|surat|vadodara|chandigarh|coimbatore|bhopal|visakhapatnam|vizag/i;
    const q = CITY_KEYWORDS.test(query) ? query : `${query} India`;

    setLoading(true);
    setNoResults(false);
    setApiError(false);
    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&countrycodes=in`;
      const res  = await fetch(url, {
        headers: { 'User-Agent': 'CollatiqApp/2.0', 'Accept-Language': 'en' },
      });
      const data = await res.json();
      const filtered = (data || [])
        .map(item => ({
          address: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }));
      setSuggestions(filtered);
      setOpen(true);
      setNoResults(filtered.length === 0 && query.length >= 5);
    } catch {
      setSuggestions([]);
      setOpen(false);
      setApiError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    setApiError(false);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  const handleSelect = (item) => {
    onChange(item.address);
    onSelect(item);
    setSuggestions([]); setOpen(false); setNoResults(false); setApiError(false);
  };

  useEffect(() => {
    const onDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div className="ac-container" ref={containerRef}>
      <div className="ac-input-wrap">
        <input
          className="ac-input"
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          autoComplete="off"
        />
        {loading && <span className="ac-spinner" aria-hidden="true" />}
      </div>
      {apiError && (
        <div className="ac-api-error" role="alert">
          Address lookup unavailable. You can still continue with the address as typed.
        </div>
      )}
      {open && (suggestions.length > 0 || noResults) && (
        <div className="ac-dropdown">
          {suggestions.map((item, i) => (
            <div key={i} className="ac-item" onMouseDown={() => handleSelect(item)}>
              <span className="ac-pin">📍</span>
              <span className="ac-text">{item.address}</span>
            </div>
          ))}
          {noResults && suggestions.length === 0 && (
            <div className="ac-no-results">No results found for this address</div>
          )}
        </div>
      )}
    </div>
  );
}
