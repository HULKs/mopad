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

  // TODO: user error, and other errors

  const pageContent = () => {
    if (userLoading) {
      return <LoadingPage />;
    }
    if (!user) {
      return <Redirect to="/login" />;
    }
    return <Dashboard user={user} />;
  };

  return (
    <Router>
      <Switch>
        <Route path="/login">
          <Login />
        </Route>
        <Route path="/register">
          <Register />
        </Route>
        <Route path="/">{pageContent()}</Route>
      </Switch>
    </Router>
  );
}
