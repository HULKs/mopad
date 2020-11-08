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

  const [usersCollection, usersCollectionLoading] = useCollection(
    firebase.firestore().collection("users")
  );
  const [users, setUsers] = useState({});
  useEffect(() => {
    if (usersCollection) {
      setUsers(usersCollection.docs.reduce((accumulator, reference) => ({
        ...accumulator,
        [reference.id]: reference.data(),
      }), {}));
    }
  }, [usersCollection]);

  const [talksCollection, talksCollectionLoading] = useCollection(
    firebase.firestore().collection("talks")
  );
  const [talks, setTalks] = useState({});
  useEffect(() => {
    if (talksCollection) {
      setTalks(talksCollection.docs.reduce((accumulator, reference) => ({
        ...accumulator,
        [reference.id]: reference.data(),
      }), {}));
    }
  }, [talksCollection]);
  // TODO: user error, and other errors

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
          {userLoading || talksCollectionLoading || usersCollectionLoading ? (
            <LoadingPage />
          ) : user ? (
            <Dashboard user={user} users={users} talks={talks} />
          ) : (
                <Redirect to="/login" />
              )}
        </Route>
      </Switch>
    </Router>
  );
}
