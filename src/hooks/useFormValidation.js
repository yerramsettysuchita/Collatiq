import { useState, useCallback } from 'react';

const RULES = {
  address:  v => (!v || v.trim().length < 10) ? 'Enter a full address (at least 10 characters).' : null,
  type:     v => (!v)                          ? 'Select a property type.'                        : null,
  area:     v => {
    if (!v) return null; // optional field — only validate if filled
    const n = parseFloat(v);
    if (isNaN(n) || n < 100)   return 'Built-up area must be at least 100 sq ft.';
    if (n > 50000)              return 'Built-up area cannot exceed 50,000 sq ft.';
    return null;
  },
  floor:    v => {
    if (!v && v !== 0) return null; // optional
    const n = parseFloat(v);
    if (isNaN(n) || n < 0)  return 'Floor number cannot be negative.';
    if (n > 150)            return 'Floor number seems too high (max 150).';
    return null;
  },
};

export function useFormValidation() {
  const [errors, setErrors] = useState({});

  const validate = useCallback((form) => {
    const next = {};
    for (const [field, rule] of Object.entries(RULES)) {
      const msg = rule(form[field]);
      if (msg) next[field] = msg;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, []);

  const clearField = useCallback((field) => {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  return { errors, validate, clearField };
}
