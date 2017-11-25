import * as React from "react";
import { HashRouter as Router, Route } from "react-router-dom";
import { Home } from "./pages/home/homePage";

export class App extends React.Component {
    public render() {
        return (
            <Router>
                <div>
                    <Route exact path="/" component={Home} />
                </div>
            </Router>
        );
    }
}
