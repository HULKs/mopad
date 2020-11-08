import React, { useState } from "react";
import { Input, TextArea, Card, Icon, Button, Popup } from "semantic-ui-react";
import Moment from "react-moment";
import firebase from "firebase";

const nerdIcon = "graduation cap";
const noobIcon = "earlybirds";

function JoinButtonGroup({ talkId, isNerd, isNoob, user }) {
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

export default function TalkCard({ talkId, talk, users, user }) {
  const nerds = [
    ...talk.nerds.filter(nerd => nerd.id === user.uid),
    ...talk.nerds.filter(nerd => nerd.id !== user.uid),
  ].map(nerd => users[nerd.id].name);

  const noobs = [
    ...talk.noobs.filter(noob => noob.id === user.uid),
    ...talk.noobs.filter(noob => noob.id !== user.uid),
  ].map(noob => users[noob.id].name);

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(""); // TODO: initial state
  const [description, setDescription] = useState("");

  const creator = users[talk.creator.id].name;

  const isNerd = talk.nerds.some(nerd => nerd.id === user.uid);
  const isNoob = talk.noobs.some(noob => noob.id === user.uid);

  const titleField = isEditing ? (
    <Input
      transparent
      fluid
      value={title}
      onChange={(e) => setTitle(e.target.value)}
    />
  ) : (
      talk.title
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
      <Card.Description>{talk.description}</Card.Description>
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
      <JoinButtonGroup talkId={talkId} isNerd={isNerd} isNoob={isNoob} user={user} />
    );

  const allowEditing = talk.creator.id === user.uid;
  const editButton = !isEditing && allowEditing && (
    <Button
      style={{ minHeight: 2.5 + "em" }}
      onClick={() => {
        setTitle(talk.title);
        setDescription(talk.description);
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
        {descriptionField}
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
      {buttonGroup}
    </Card>
  );
}
