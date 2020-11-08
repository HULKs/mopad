import React from "react";
import { Card, Icon, Button, Popup } from "semantic-ui-react";
import Moment from "react-moment";
import firebase from "firebase";

const nerdIcon = "graduation cap";
const noobIcon = "earlybirds";

export default function TalkCard({ talkId, talk, users, user }) {
  const nerds = [
    ...talk.nerds.filter(nerd => nerd.id === user.uid),
    ...talk.nerds.filter(nerd => nerd.id !== user.uid),
  ].map(nerd => users[nerd.id].name);

  const noobs = [
    ...talk.noobs.filter(noob => noob.id === user.uid),
    ...talk.noobs.filter(noob => noob.id !== user.uid),
  ].map(noob => users[noob.id].name);

  const creator = users[talk.creator.id].name;

  const isNerd = talk.nerds.some(nerd => nerd.id === user.uid);
  const isNoob = talk.noobs.some(noob => noob.id === user.uid);

  return (
    <Card raised>
      <Card.Content>
        <Card.Header>{talk.title}</Card.Header>
        <Card.Meta style={{ marginTop: "0.5rem" }}>
          <Icon name="clock" style={{ marginRight: "0.25rem" }} />
          {talk.scheduled_at
            ? <Popup
              content={<Moment local>{talk.scheduled_at.toDate()}</Moment>}
              trigger={<Moment fromNow local>{talk.scheduled_at.toDate()}</Moment>}
            />
            : <>not scheduled yet</>
          }
        </Card.Meta>
      </Card.Content>
      <Card.Content style={{ height: 100 + "%" }}>
        <Card.Description>{talk.description}</Card.Description>
      </Card.Content>
      <Card.Content>
        <Icon name={nerdIcon} />
        <b>Nerds</b>: {nerds.join(", ")}
        <br />
        <Icon name={noobIcon} />
        <b>Noobs</b>: {noobs.join(", ")}
        <Card.Meta style={{ marginTop: "0.5rem" }}>
          <Icon name="edit" />
          <b>Creator</b>: {creator}
        </Card.Meta>
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
