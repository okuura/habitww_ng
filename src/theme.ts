import { createTheme } from '@mui/material/styles';
import { green, teal } from '@mui/material/colors';

const theme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: green[700],
          light: green[400],
          dark: green[900],
        },
        secondary: {
          main: teal[500],
        },
        background: {
          default: '#f5f7f5',
          paper: '#ffffff',
        },
      },
    },
    dark: {
      palette: {
        primary: {
          main: green[400],
          light: green[200],
          dark: green[700],
        },
        secondary: {
          main: teal[300],
        },
        background: {
          default: '#121212',
          paper: '#1e1e1e',
        },
      },
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: {
    borderRadius: 12,
  },
});

export default theme;
