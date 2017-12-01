import * as React from "react";
import { HashRouter as Router } from "react-router-dom";
import { Route, Redirect } from "react-router";
import AppBar from "material-ui/AppBar";
import TopicPage from "./pages/home/topicPage";
import LoginPage from "./pages/login/loginPage";
import { PrivateRoute } from "./business/routerAuth";
import { ISessionStore, LocalSessionStore } from "./business/auth";

export class App extends React.Component {
    private sessionStore: ISessionStore;

    constructor(props) {
        super(props);
        this.sessionStore = new LocalSessionStore();
    }

    public render() {
        return (
            <Router>
                <div>
                    <AppBar title="mopad" />
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
	return (<Redirect to="/login" />);
}
