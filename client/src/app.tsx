import * as React from "react";
import { HashRouter as Router, Route } from "react-router-dom";
import { Home } from "./pages/home/homePage";
import LoginPage from "./pages/login/loginPage";

export class App extends React.Component {
    public render() {
        return (
            <Router>
                <div>
                    <Route exact path="/" component={Home} />
                    <Route exact path="/login" component={LoginPage} />
                </div>
            </Router>
        );
    }
}
