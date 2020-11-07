import React, { useState } from "react";
import { Input, Form, TextArea, Card, Button } from "semantic-ui-react";
import firebase from "firebase";

export default function EditableCard() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  return (
    <Card inverted>
      <Card.Content>
        <Card.Header>
          <Input transparent fluid placeholder="Talk Topic..." value={title} onChange={e => setTitle(e.target.value)} />
        </Card.Header>
      </Card.Content>
      <Card.Content>
        <Card.Description>
          <Form>
            <TextArea placeholder="What's your talk about?" value={description} onChange={e => setDescription(e.target.value)} />
          </Form>
        </Card.Description>
      </Card.Content>
      <Card.Content>
        <Button onClick={async () => {
          await firebase.firestore().collection("talks").add({
            creator: "users/lxnlapA1KgtPSEp63kZ3", // TODO: from auth
            description: description,
            location: "Raum A",
            nerds: [
              firebase.firestore().doc("users/lxnlapA1KgtPSEp63kZ3"),
            ],
            noobs: [
              firebase.firestore().doc("users/lxnlapA1KgtPSEp63kZ3"),
            ],
            time: new Date,
            title: title,
            type: "discussion",
          });
          setTitle("");
          setDescription("");
        }}>Create</Button>
      </Card.Content>
    </Card>
  );
}
