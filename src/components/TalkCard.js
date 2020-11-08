import React, { useState, useEffect } from "react";
import { Input, TextArea, Card, Icon, Button } from "semantic-ui-react";
import firebase from "firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useDocument } from "react-firebase-hooks/firestore";
import PlaceholderCard from "./PlaceholderCard";

const nerdIcon = "graduation cap";
const noobIcon = "earlybirds";

function JoinButtonGroup({ talkId, isNerd, isNoob }) {
  const [user, userLoading] = useAuthState(firebase.auth());

  return (
    <Button.Group size="medium">
      <Button
        toggle
        active={isNerd}
        onClick={() => {
          if (isNerd) {
            firebase
              .firestore()
              .doc(`talks/${talkId}`)
              .update({
                nerds: firebase.firestore.FieldValue.arrayRemove(
                  firebase.firestore().doc(`users/${user.uid}`)
                ),
              });
          } else {
            firebase
              .firestore()
              .doc(`talks/${talkId}`)
              .update({
                nerds: firebase.firestore.FieldValue.arrayUnion(
                  firebase.firestore().doc(`users/${user.uid}`)
                ),
                noobs: firebase.firestore.FieldValue.arrayRemove(
                  firebase.firestore().doc(`users/${user.uid}`)
                ),
              });
          }
        }}
      >
        Join as <Icon style={{ marginLeft: 0.1 + "em" }} name={nerdIcon} />
      </Button>
      <Button.Or />
      <Button
        toggle
        active={isNoob}
        onClick={() => {
          if (isNoob) {
            firebase
              .firestore()
              .doc(`talks/${talkId}`)
              .update({
                noobs: firebase.firestore.FieldValue.arrayRemove(
                  firebase.firestore().doc(`users/${user.uid}`)
                ),
              });
          } else {
            firebase
              .firestore()
              .doc(`talks/${talkId}`)
              .update({
                nerds: firebase.firestore.FieldValue.arrayRemove(
                  firebase.firestore().doc(`users/${user.uid}`)
                ),
                noobs: firebase.firestore.FieldValue.arrayUnion(
                  firebase.firestore().doc(`users/${user.uid}`)
                ),
              });
          }
        }}
      >
        Join as <Icon style={{ marginLeft: 0.1 + "em" }} name={noobIcon} />
      </Button>
    </Button.Group>
  );
}

function EditButtonGroup({ onCancelClick, onUpdateClick }) {
  return (
    <Button.Group size="medium">
      <Button basic color="red" onClick={onCancelClick}>
        Cancel
      </Button>
      <Button basic color="green" onClick={onUpdateClick}>
        Update
      </Button>
    </Button.Group>
  );
}

export default function TalkCard({ talkId }) {
  const [talk, talkLoading] = useDocument(
    firebase.firestore().doc(`talks/${talkId}`)
  );

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [user, userLoading] = useAuthState(firebase.auth());
  const [nerds, setNerds] = useState([]);
  useEffect(() => {
    if (talk && user) {
      (async () => {
        const resolvedReferences = await Promise.all(
          [
            ...talk.data().nerds.filter((nerd) => nerd.id === user.uid),
            ...talk.data().nerds.filter((nerd) => nerd.id !== user.uid),
          ].map((reference) => reference.get())
        );
        setNerds(resolvedReferences.map((reference) => reference.data()));
      })();
    }
  }, [talk, user]);

  const [noobs, setNoobs] = useState([]);
  useEffect(() => {
    if (talk) {
      (async () => {
        const resolvedReferences = await Promise.all(
          [
            ...talk.data().noobs.filter((noob) => noob.id === user.uid),
            ...talk.data().noobs.filter((noob) => noob.id !== user.uid),
          ].map((reference) => reference.get())
        );
        setNoobs(resolvedReferences.map((reference) => reference.data()));
      })();
    }
  }, [talk, user]);

  const [creator, setCreator] = useState("");
  useEffect(() => {
    if (talk) {
      (async () => {
        const resolvedReference = await talk.data().creator.get();
        setCreator(resolvedReference.data().name);
      })();
    }
  }, [talk]);

  const isNerd =
    talkLoading || userLoading
      ? false
      : talk.data().nerds.some((nerd) => nerd.id === user.uid);
  const isNoob =
    talkLoading || userLoading
      ? false
      : talk.data().noobs.some((noob) => noob.id === user.uid);
  // TODO: user error

  if (talk) {
    const titleField = isEditing ? (
      <Input
        transparent
        fluid
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
    ) : (
      talk.data().title
    );

    const descriptionField = isEditing ? (
      <TextArea
        style={{
          width: 100 + "%",
          height: 100 + "%",
          border: "none",
          padding: 0,
        }}
        rows={5}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
    ) : (
      <Card.Description>{talk.data().description}</Card.Description>
    );

    const buttonGroup = isEditing ? (
      <EditButtonGroup
        onCancelClick={() => {
          setIsEditing(false);
        }}
        onUpdateClick={() => {
          firebase.firestore().doc(`talks/${talkId}`).update({
            title: title,
            description: description,
          });

          setIsEditing(false);
        }}
      />
    ) : (
      <JoinButtonGroup talkId={talkId} isNerd={isNerd} isNoob={isNoob} />
    );

    const allowEditing = talk.data().creator.id === user.uid;
    const editButton = !isEditing && allowEditing && (
      <Button
        style={{ minHeight: 2.5 + "em" }}
        onClick={() => {
          setTitle(talk.data().title);
          setDescription(talk.data().description);
          setIsEditing(true);
        }}
      >
        EditCard
      </Button>
    );

    return (
      <Card raised>
        {editButton}
        <Card.Content>
          <Card.Header>{titleField}</Card.Header>
          <Card.Meta>Created by: {creator}</Card.Meta>
        </Card.Content>
        <Card.Content style={{ height: 100 + "%" }}>
          {descriptionField}
        </Card.Content>
        <Card.Content>
          <Icon name={nerdIcon} />
          <b>Nerds</b>: {nerds.map((nerd) => nerd.name).join(", ")}
          <br />
          <Icon name={noobIcon} />
          <b>Noobs</b>: {noobs.map((noob) => noob.name).join(", ")}
        </Card.Content>
        {buttonGroup}
      </Card>
    );
  }
  // TODO: loading, error
  return <PlaceholderCard />;
}
