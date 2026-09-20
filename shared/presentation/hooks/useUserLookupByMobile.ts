import { useState, useCallback, useRef } from 'react';
import { apiClient } from '../../core/network/apiClient';
import { cleanMobile } from '../../core/utils/formatters';

export interface UserLookupResult {
  id: number;
  name: string;
}

export function useUserLookupByMobile() {
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingUser, setExistingUser] = useState<UserLookupResult | null>(null);
  const debounceTimerRef = useRef<any>(null);

  const reset = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setMobile('');
    setLoading(false);
    setExistingUser(null);
  }, []);

  const handleMobileChange = useCallback(
    (inputMobile: string, onUserFound?: (user: UserLookupResult) => void) => {
      const sanitized = cleanMobile(inputMobile);
      setMobile(sanitized);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (sanitized.length === 10) {
        setLoading(true);
        debounceTimerRef.current = setTimeout(async () => {
          try {
            const res = await apiClient.get(`/UserMaster/by-mobile/${sanitized}`);
            if (res.data) {
              const userObj: UserLookupResult = {
                id: Number(res.data.id ?? res.data.Id ?? 0),
                name: String(res.data.name ?? res.data.Name ?? ''),
              };
              setExistingUser(userObj);
              if (onUserFound) {
                onUserFound(userObj);
              }
            } else {
              setExistingUser(null);
            }
          } catch {
            setExistingUser(null);
          } finally {
            setLoading(false);
          }
        }, 200);
      } else {
        setExistingUser(null);
        setLoading(false);
      }
    },
    []
  );

  return {
    mobile,
    setMobile,
    loading,
    existingUser,
    setExistingUser,
    handleMobileChange,
    reset,
  };
}
