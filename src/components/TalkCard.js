import React, { useState, useEffect } from "react";
import { Card, Icon, Button } from "semantic-ui-react";
import firebase from "firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useDocument } from "react-firebase-hooks/firestore";

const nerdIcon = "graduation cap";
const noobIcon = "earlybirds";

export default function TalkCard({ talkId }) {
  const [talk, talkLoading] = useDocument(
    firebase.firestore().doc(`talks/${talkId}`),
  );

  const [user, userLoading] = useAuthState(firebase.auth());
  const [nerds, setNerds] = useState([]);
  useEffect(() => {
    if (talk && user) {
      (async () => {
        const resolvedReferences = await Promise.all(
          [
            ...talk.data().nerds.filter(nerd => nerd.id === user.uid),
            ...talk.data().nerds.filter(nerd => nerd.id !== user.uid),
          ].map(reference => reference.get()),
        );
        setNerds(resolvedReferences.map(reference => reference.data()));
      })();
    }
  }, [talk, user]);

  const [noobs, setNoobs] = useState([]);
  useEffect(() => {
    if (talk) {
      (async () => {
        const resolvedReferences = await Promise.all(
          [
            ...talk.data().noobs.filter(noob => noob.id === user.uid),
            ...talk.data().noobs.filter(noob => noob.id !== user.uid),
          ].map(reference => reference.get()),
        );
        setNoobs(resolvedReferences.map(reference => reference.data()));
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
      : talk.data().nerds.some(nerd => nerd.id === user.uid);
  const isNoob =
    talkLoading || userLoading
      ? false
      : talk.data().noobs.some(noob => noob.id === user.uid);
  // TODO: user error

  if (talk) {
    return (
      <Card raised>
        <Card.Content>
          <Card.Header>{talk.data().title}</Card.Header>
          <Card.Meta>Created by: {creator}</Card.Meta>
        </Card.Content>
        <Card.Content style={{ height: 100 + "%" }}>
          <Card.Description>{talk.data().description}</Card.Description>
        </Card.Content>
        <Card.Content>
          <Icon name={nerdIcon} />
          <b>Nerds</b>: {nerds.map(nerd => nerd.name).join(", ")}
          <br />
          <Icon name={noobIcon} />
          <b>Noobs</b>: {noobs.map(noob => noob.name).join(", ")}
        </Card.Content>
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
      </Card>
    );
  }
  // TODO: loading, error
  return <>Loading...</>;
}
