import React from "react";
import ReactDOM from "react-dom";
import "./fonts.css";
import "./index.css";
import App from "./App";
import "./firebase";
import {
  MuiPickersUtilsProvider,
} from "@material-ui/pickers";
import {
  createMuiTheme,
  ThemeProvider,
} from "@material-ui/core/styles";
import green from "@material-ui/core/colors/green";
import MomentUtils from "@date-io/moment";

const theme = createMuiTheme({
  palette: {
    primary: {
      light: green[500],
      main: green[700],
      dark: green[800],
    },
  },
});

ReactDOM.render(
  <React.StrictMode>
    <MuiPickersUtilsProvider utils={MomentUtils}>
      <ThemeProvider theme={theme}>
        <App />
      </ThemeProvider>
    </MuiPickersUtilsProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
