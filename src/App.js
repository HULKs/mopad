import React from "react";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect,
} from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Register from "./components/Register";
import LoadingPage from "./components/LoadingPage";
import firebase from "firebase";
import { useAuthState } from "react-firebase-hooks/auth";

export default function App() {
  const [user, userLoading] = useAuthState(firebase.auth());
  // TODO: userLoading, userError
  return (
    <Router>
      <Switch>
        <Route path="/login">
          <Login />
        </Route>
        <Route path="/register">
          <Register />
        </Route>
        <Route path="/">
          {userLoading ? (
            <LoadingPage />
          ) : user ? (
            <Dashboard />
          ) : (
            <Redirect to="/login" />
          )}
        </Route>
      </Switch>
    </Router>
  );
}
