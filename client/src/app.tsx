import * as React from "react";
import { HashRouter as Router } from "react-router-dom";
import { Route, Redirect } from "react-router";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import IconButton from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import MenuIcon from "@material-ui/icons/Menu";
import TopicPage from "./pages/home/topicPage";
import LoginPage from "./pages/login/loginPage";
import AppMenu from "./app/appMenu";
import { PrivateRoute } from "./business/routerAuth";
import { ISessionStore, LocalSessionStore } from "./business/auth";

interface AppState {
    menuOpen: boolean;
    anchorEl: HTMLElement;
}

export class App extends React.Component<{}, AppState> {
    private sessionStore: ISessionStore;

    constructor(props) {
        super(props);
        this.state = {
            menuOpen: false,
            anchorEl: null
        };
        this.sessionStore = new LocalSessionStore();
    }

    public render() {
        const { menuOpen, anchorEl } = this.state;
        return (
            <Router>
                <div>
                    <AppBar position="static">
                        <Toolbar>
                            <IconButton
                                onClick={e =>
                                    this.setState({
                                        menuOpen: !this.state.menuOpen,
                                        anchorEl: e.currentTarget
                                    })
                                }
                            >
                                <MenuIcon />
                            </IconButton>
                            <Typography variant="h6" color="inherit">
                                mopad
                            </Typography>
                        </Toolbar>
                    </AppBar>
                    <AppMenu
                        open={menuOpen}
                        onClick={() => this.setState({ menuOpen: false })}
                        anchorEl={anchorEl}
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
