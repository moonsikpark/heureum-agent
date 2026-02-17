import { useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';

/**
 * Deep link route: heureum://auth/callback?token=XXX
 * Expo Router matches this file, extracts the token param,
 * and passes it back to the home screen to handle in the WebView.
 */
export default function AuthCallback() {
  const { token } = useLocalSearchParams<{ token: string }>();

  useEffect(() => {
    if (token) {
      // Navigate to home with the token as a param
      router.replace({ pathname: '/', params: { authToken: token } });
    } else {
      router.replace('/');
    }
  }, [token]);

  return null;
}
