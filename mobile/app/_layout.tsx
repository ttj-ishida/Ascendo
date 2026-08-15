import { Stack } from 'expo-router';
import { AuthProvider } from '../src/features/auth/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack />
    </AuthProvider>
  );
}
