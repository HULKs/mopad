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

const client = new ApolloClient({
    link: from([
        new AuthenticationLink(new LocalSessionStore()),
        new HttpLink({ uri: "https://api.graph.cool/simple/v1/mopad" })
    ]),
    cache: new InMemoryCache()
});

ReactDOM.render(
    <IntlProvider locale="en" messages={require("./i18n/en-US.json")}>
        <ApolloProvider client={client}>
            <App />
        </ApolloProvider>
    </IntlProvider>,
    document.getElementById("root")
);
