import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#0095F6', light: '#4DB5F9', dark: '#0074CC' },
    secondary: { main: '#FF3040' },
    background: {
      default: '#000000',
      paper: '#000000',
    },
    text: {
      primary: '#F5F5F5',
      secondary: '#A8A8A8',
    },
    divider: '#262626',
    action: {
      hover: 'rgba(255,255,255,0.05)',
      selected: 'rgba(255,255,255,0.08)',
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    body2: { fontSize: '0.875rem' },
    caption: { fontSize: '0.75rem', color: '#A8A8A8' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#000000',
          color: '#F5F5F5',
          '&::-webkit-scrollbar': { width: 0, background: 'transparent' },
        },
        '*::-webkit-scrollbar': { width: 0, background: 'transparent' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 600,
        },
        contained: {
          backgroundColor: '#0095F6',
          '&:hover': { backgroundColor: '#1877F2' },
        },
        outlined: {
          borderColor: '#363636',
          color: '#F5F5F5',
          '&:hover': { borderColor: '#555', backgroundColor: 'transparent' },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#121212',
            borderRadius: 8,
            '& fieldset': { borderColor: '#363636' },
            '&:hover fieldset': { borderColor: '#555' },
            '&.Mui-focused fieldset': { borderColor: '#0095F6' },
          },
          '& .MuiInputBase-input': { color: '#F5F5F5', fontSize: '0.875rem' },
          '& .MuiInputLabel-root': { color: '#A8A8A8' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#000000',
          backgroundImage: 'none',
          borderRadius: 8,
          border: '1px solid #262626',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#262626',
          backgroundImage: 'none',
          borderRadius: 12,
        },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: '#262626' } },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { backgroundColor: '#F5F5F5' },
        root: { borderBottom: '1px solid #262626' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: '#A8A8A8',
          textTransform: 'none',
          fontWeight: 600,
          '&.Mui-selected': { color: '#F5F5F5' },
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: { backgroundColor: '#363636' },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { color: '#F5F5F5' },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: '#262626',
          color: '#F5F5F5',
        },
      },
    },
  },
});

export default theme;