import { createMuiTheme } from "@material-ui/core/styles";

export default createMuiTheme({
    palette: {
        background: {
            default: "#474c55"
        },
        primary: {
            main: "#e7b142",
            light: "#58beed",
            dark: "#606060",
            contrastText: "#58beed"
        },
        text: {
            primary: "#ffffff",
            secondary: "#e0e0e0",
            hint: "#303030",
            disabled: "#a0a0a0"
        }
    }
});
