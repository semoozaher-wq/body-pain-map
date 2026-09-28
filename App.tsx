// App.tsx

import { ThemeProvider } from './hooks/useTheme';
import MainApp from './MainApp';

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}
