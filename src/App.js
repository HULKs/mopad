import React, { useState, useEffect } from "react";
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
import { useCollection } from "react-firebase-hooks/firestore";

export default function App() {
  const [user, userLoading] = useAuthState(firebase.auth());

  const [teamsCollection, teamsCollectionLoading] = useCollection(
    firebase.firestore().collection("teams")
  );
  const [teams, setTeams] = useState({});
  useEffect(() => {
    if (teamsCollection) {
      setTeams(
        teamsCollection.docs.reduce(
          (accumulator, reference) => ({
            ...accumulator,
            [reference.id]: reference.data(),
          }),
          {}
        )
      );
    }
  }, [teamsCollection]);

  // TODO: user error, and other errors

  if (userLoading || teamsCollectionLoading) {
    return <LoadingPage />;
  }

  const pageContent = () => {
    if (!user) {
      return <Redirect to="/login" />;
    }
    return <Dashboard user={user} teams={teams} />;
  };

  return (
    <Router>
      <Switch>
        <Route path="/login">
          <Login />
        </Route>
        <Route path="/register">
          <Register teams={teams} />
        </Route>
        <Route path="/">{pageContent()}</Route>
      </Switch>
    </Router>
  );
}
