import { createTheme } from "@mui/material/styles";

/** Sidebar + app bar start: same dark violet as navigation drawer. */
export const layoutNavBackground = "#251F34";

/** Same paint as `MuiAppBar` — use behind header logo so PNG transparency matches the bar. */
export const appBarBackgroundImage = `linear-gradient(90deg, ${layoutNavBackground} 0%, #1F5A7A 100%)`;

export const theme = createTheme({
  palette: {
    primary: {
      main: "#253746", // Pantone 7546
      dark: "#1B2833",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#1F5A7A", // Pantone 7699
      dark: "#17445C",
      contrastText: "#FFFFFF",
    },
    success: {
      main: "#009639", // Pantone 348
    },
    warning: {
      main: "#E56A54", // Pantone 7417
    },
    error: {
      main: "#CB333B", // Pantone 1797
    },
    background: {
      default: "#F3F4F6",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#253746",
      secondary: "#5F6B73",
    },
  },

  typography: {
    fontFamily: `"Inter", "Segoe UI", "Roboto", "Arial", sans-serif`,
    h6: {
      fontWeight: 800,
      letterSpacing: "0.02em",
    },
    button: {
      fontWeight: 700,
      textTransform: "none",
    },
  },

  shape: {
    borderRadius: 12,
  },

  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: appBarBackgroundImage,
          boxShadow: "0 6px 18px rgba(37, 31, 52, 0.28)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          minHeight: 42,
          paddingLeft: 18,
          paddingRight: 18,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: layoutNavBackground,
          color: "#FFFFFF",
        },
      },
    },
    /** Menus, Select dropdowns, etc. default to `zIndex.modal` and can paint under Dialog backdrops. */
    MuiPopover: {
      styleOverrides: {
        root: ({ theme }) => ({
          zIndex: theme.zIndex.modal + 50,
        }),
      },
    },
    MuiPopper: {
      styleOverrides: {
        root: ({ theme }) => ({
          zIndex: theme.zIndex.modal + 50,
        }),
      },
    },
  },
});
