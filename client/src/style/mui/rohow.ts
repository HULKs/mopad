import { createMuiTheme } from "@material-ui/core/styles";

export default createMuiTheme({
    typography: {
        useNextVariants: true
    },
    palette: {
        primary: {
            main: "#4bb4c9",
            contrastText: "#ffffff"
        }
    }
});
