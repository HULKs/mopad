import React, { useState } from "react";
import { Input, Form, TextArea, Card, Button } from "semantic-ui-react";
import firebase from "firebase";
import { useAuthState } from "react-firebase-hooks/auth";

export default function EditableCard() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [user, ,] = useAuthState(firebase.auth());
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
      <Card.Content>
        <Button
          onClick={async () => {
            if (title == "")
            {
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
                nerds: [firebase.firestore().doc(`users/${user.uid}`)],
                noobs: [],
                time: new Date(),
                title: title,
                type: "discussion",
              });
            setTitle("");
            setDescription("");
          }}
        >
          Create
        </Button>
      </Card.Content>
    </Card>
  );
}
