import * as React from "react";
import * as ReactDOM from "react-dom";
import { App } from "./app";
import { ApolloProvider } from "react-apollo";
import { ApolloClient } from "apollo-client";
import { HttpLink } from "apollo-link-http";
import { InMemoryCache } from "apollo-cache-inmemory";
import { from } from "apollo-link";
import { AuthenticationLink, LocalSessionStore } from "./business/auth";
import { IntlProvider } from "react-intl";
import MuiThemeProvider from "material-ui/styles/MuiThemeProvider"; // <- Toggle Project here: * for ARWo, ** for RoHOW
import "./style/main.less";

/**/ // <- Toggle Project here: * for ARWo, ** for RoHOW
import theme from "./style/mui/rohow";
const graphCoolUri = "https://api.graph.cool/simple/v1/mopad";
document.getElementsByTagName("body")[0].style.backgroundColor = "#f5f5f5";
/*/
import theme from "./style/mui/arwo";
const graphCoolUri = "https://api.graph.cool/simple/v1/arwo";
document.getElementsByTagName("body")[0].style.backgroundColor = "#353942";
/**/

const client = new ApolloClient({
    link: from([
        new AuthenticationLink(new LocalSessionStore()),
        new HttpLink({ uri: graphCoolUri })
    ]),
    cache: new InMemoryCache()
});

ReactDOM.render(
    <IntlProvider locale="en" messages={require("./i18n/en-US.json")}>
        <ApolloProvider client={client}>
            <MuiThemeProvider muiTheme={theme}>
                <App />
            </MuiThemeProvider>
        </ApolloProvider>
    </IntlProvider>,
    document.getElementById("root")
);
