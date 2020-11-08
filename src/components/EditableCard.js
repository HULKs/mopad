import React, { useState } from "react";
import { Icon, Input, Form, TextArea, Card, Button } from "semantic-ui-react";
import firebase from "firebase";
import { useAuthState } from "react-firebase-hooks/auth";

const nerdIcon = "graduation cap";
const noobIcon = "earlybirds";

export default function EditableCard() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [user, ,] = useAuthState(firebase.auth());

  const addCard = async (isNerd) => {
    if (title === "") {
      alert("Please specify a title!");
      return;
    }
    await firebase
      .firestore()
      .collection("talks")
      .add({
        creator: firebase.firestore().doc(`users/${user.uid}`),
        description: description,
        location: "Raum A",
        nerds: isNerd ? [firebase.firestore().doc(`users/${user.uid}`)] : [],
        noobs: !isNerd ? [firebase.firestore().doc(`users/${user.uid}`)] : [],
        time: new Date(),
        title: title,
        type: "discussion",
      });
    setTitle("");
    setDescription("");
  };
  // TODO: user loading, user error
  return (
    <Card inverted>
      <Card.Content>
        <Card.Header>
          <Input
            transparent
            fluid
            placeholder="Talk Topic..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Card.Header>
      </Card.Content>
      <Card.Content>
        <Card.Description>
          <Form>
            <TextArea
              style={{ border: "none", padding: 0 }}
              rows={5}
              placeholder="What's your talk about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Form>
        </Card.Description>
      </Card.Content>
      <Button.Group size="medium">
        <Button onClick={() => addCard(true)}>
          Create as <Icon style={{ marginLeft: 0.1 + "em" }} name={nerdIcon} />
        </Button>
        <Button.Or />
        <Button onClick={() => addCard(false)}>
          Create as <Icon style={{ marginLeft: 0.1 + "em" }} name={noobIcon} />
        </Button>
      </Button.Group>
    </Card>
  );
}
