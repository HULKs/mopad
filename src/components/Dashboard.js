import React, { useState, useEffect } from "react";
import CardGrid from "./CardGrid";
import DashboardMenu from "./DashboardMenu";
import LoadingDashboard from "./LoadingDashboard";
import { Container } from "semantic-ui-react";
import { useCollection } from "react-firebase-hooks/firestore";
import firebase from "firebase";

export default function Dashboard({ user }) {
  const [usersCollection, usersCollectionLoading] = useCollection(
    firebase.firestore().collection("users")
  );
  const [users, setUsers] = useState({});
  useEffect(() => {
    if (usersCollection) {
      setUsers(
        usersCollection.docs.reduce(
          (accumulator, reference) => ({
            ...accumulator,
            [reference.id]: reference.data(),
          }),
          {}
        )
      );
    }
  }, [usersCollection]);

  const [talksCollection, talksCollectionLoading] = useCollection(
    firebase.firestore().collection("talks")
  );
  const [talks, setTalks] = useState({});
  useEffect(() => {
    if (talksCollection) {
      setTalks(
        talksCollection.docs.reduce(
          (accumulator, reference) => ({
            ...accumulator,
            [reference.id]: reference.data(),
          }),
          {}
        )
      );
    }
  }, [talksCollection]);

  // TODO: user error, and other errors

  if (talksCollectionLoading || usersCollectionLoading) {
    return <LoadingDashboard />;
  }
  return (
    <>
      <DashboardMenu />
      <Container style={{ width: "90%" }}>
        <CardGrid user={user} users={users} talks={talks} />
      </Container>
    </>
  );
}
