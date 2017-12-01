import * as React from "react";
import { HashRouter as Router } from "react-router-dom";
import { Route, Redirect } from "react-router";
import AppBar from "material-ui/AppBar";
import TopicPage from "./pages/home/topicPage";
import LoginPage from "./pages/login/loginPage";
import AppMenu from "./app/appMenu";
import { PrivateRoute } from "./business/routerAuth";
import { ISessionStore, LocalSessionStore } from "./business/auth";

interface AppState {
    menuOpen: boolean;
}

export class App extends React.Component<{}, AppState> {
    private sessionStore: ISessionStore;

    constructor(props) {
        super(props);
        this.state = {
            menuOpen: false
        };
        this.sessionStore = new LocalSessionStore();
    }

    public render() {
        const { menuOpen } = this.state;
        return (
            <Router>
                <div>
                    <AppBar
                        title="mopad"
                        onLeftIconButtonTouchTap={() =>
                            this.setState({ menuOpen: !this.state.menuOpen })
                        }
                    />
                    <AppMenu
                        open={menuOpen}
                        onClick={() => this.setState({ menuOpen: false })}
                    />
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
