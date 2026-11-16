"use client";
import { createTheme } from "@mui/material/styles";
import { faIR } from "@mui/material/locale";

// Working values from the local foundations; pending brand approval.
export const theme = createTheme(
  {
    direction: "rtl",
    palette: {
      mode: "light",
      primary: { main: "#6b2026", dark: "#53191e", contrastText: "#ffffff" },
      secondary: { main: "#f9c65b", contrastText: "#2e2524" },
      background: { default: "#fffbf5", paper: "#ffffff" },
      text: { primary: "#2e2524", secondary: "#6f6260" },
    },
    typography: {
      fontFamily: "var(--font-vazirmatn), Tahoma, sans-serif",
      button: { fontWeight: 600 },
    },
    shape: { borderRadius: 9 },
    components: {
      MuiButtonBase: {
        styleOverrides: {
          root: {
            "&.Mui-focusVisible, &:focus-visible": {
              outline: "3px solid #a65358",
              outlineOffset: "3px",
            },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { minHeight: 44, textTransform: "none" } },
      },
      MuiIconButton: {
        styleOverrides: { root: { minWidth: 44, minHeight: 44 } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { minHeight: 44 },
          notchedOutline: { borderColor: "#786a65" },
        },
      },
      MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
      MuiCssBaseline: {
        styleOverrides: {
          ":focus-visible": {
            outline: "3px solid #a65358",
            outlineOffset: "3px",
          },
        },
      },
    },
  },
  faIR,
);
