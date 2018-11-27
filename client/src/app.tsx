import * as React from "react";
import { HashRouter as Router } from "react-router-dom";
import { Route, Redirect } from "react-router";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import TopicPage from "./pages/home/topicPage";
import LoginPage from "./pages/login/loginPage";
import LogoutButton from "./app/logoutButton";
import FullScreenButton from "./app/fullScreenButton";
import { PrivateRoute } from "./business/routerAuth";
import { ISessionStore, LocalSessionStore } from "./business/auth";

export class App extends React.Component<{ title?: string }> {
    private sessionStore: ISessionStore;

    constructor(props) {
        super(props);
        this.sessionStore = new LocalSessionStore();
    }

    public render() {
        return (
            <Router>
                <div>
                    <AppBar position="static" style={{ width: "100%" }}>
                        <Toolbar variant="dense">
                            <Typography variant="h6" color="inherit" id="app-title">
                                {this.props.title || "mopad"}
                            </Typography>
                            <div style={{ flexGrow: 1 }} />
                            <FullScreenButton />
                            <LogoutButton />
                        </Toolbar>
                    </AppBar>
                    <Route exact path="/login" component={LoginPage} />
                    <PrivateRoute
                        sessionStore={this.sessionStore}
                        exact
                        path="/logout"
                        component={LogoutPage}
                    />
                    <PrivateRoute
                        sessionStore={this.sessionStore}
                        exact
                        path="/"
                        component={TopicPage}
                    />
                </div>
            </Router>
        );
    }
}

function LogoutPage() {
    const sessionStore = new LocalSessionStore();
    sessionStore.clearSession();
    return <Redirect to="/login" />;
}
