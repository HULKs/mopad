import { createMuiTheme } from "@material-ui/core/styles";

export default createMuiTheme({
    palette: {
        background: {
            paper: "#474c55"
        },
        primary: {
            main: "#e7b142",
            dark: "#e7b142",
            contrastText: "#303030"
        },
        secondary: {
            main: "#58beed"
        },
        text: {
            primary: "#ffffff",
            secondary: "#e0e0e0",
            hint: "#303030",
            disabled: "#a0a0a0"
        }
    }
});
