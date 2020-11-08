import React from "react";
import { Card } from "semantic-ui-react";
import TalkCard from "./TalkCard";
import EditableCard from "./EditableCard";
import LoadingPage from "./LoadingPage";
import firebase from "firebase";
import { useCollection } from "react-firebase-hooks/firestore";

export default function CardGrid() {
  const [talks, ,] = useCollection(
    firebase.firestore().collection("talks").orderBy("time")
  );
  // TODO: loading, error
  if (talks !== undefined) {
    return (
      <Card.Group stackable>
        {talks.docs.map((talk) => (
          <TalkCard talkId={talk.id} />
        ))}
        <EditableCard />
      </Card.Group>
    );
  }
  return <LoadingPage />;
}
