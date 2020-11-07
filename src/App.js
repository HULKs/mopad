import React from "react";
import {
  BrowserRouter as Router,
  Switch,
  Route,
} from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Register from "./components/Register";

export default function App() {

  return (
    <Router>
      <Switch>
        <Route path='/login'>
          <Login/>
        </Route>
        <Route path='/register'>
          <Register/>
        </Route>
        <Route path='/'>
          <Dashboard/>
        </Route>
      </Switch>
    </Router>
  );
}
