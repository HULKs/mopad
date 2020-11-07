import React, { useState, useEffect } from "react";
import { Card, Icon, Button } from "semantic-ui-react";
import firebase from "firebase";
import { useDocument } from "react-firebase-hooks/firestore";

const nerd_icon = "graduation cap";
const noob_icon = "blind";

// TODO: Don't allow is_nerd && is_noob
const is_nerd = false;
const is_noob = false;

function useReferences(references, dependencies) {
  const [values, setValues] = useState([]);
  useEffect(() => {
    (async () => {
      const resolvedReferences = await Promise.all(references.map((reference) => reference.get()));
      setValues(resolvedReferences.map(reference => reference.data()));
    })();
  }, dependencies);
  return values;
}

export default function TalkCard({ talkId }) {
  const [talk, talkLoading, talkError] = useDocument(
    firebase.firestore().doc(`talks/${talkId}`),
  );
  const nerds = useReferences(talk ? talk.data().nerds : [], [talk]);
  const noobs = useReferences(talk ? talk.data().noobs : [], [talk]);

  if (talk) {
    return (
      <Card raised>
        <Card.Content>
          <Card.Header>{talk.data().title}</Card.Header>
        </Card.Content>
        <Card.Content style={{ height: 100 + "%" }}>
          <Card.Description>{talk.data().description}</Card.Description>
        </Card.Content>
        <Card.Content>
          <Icon name={nerd_icon} />
          <b>Nerds</b>: {nerds.map(nerd => nerd.name).join(', ')}
          <br />
          <Icon name={noob_icon} />
          <b>Noobs</b>: {noobs.map(noob => noob.name).join(', ')}
        </Card.Content>
        <Button.Group size="mini">
          <Button toggle active={is_nerd}>
            I'm a{" "}
            <span style={{ marginLeft: 0.1 + "em" }}>
              <Icon name={nerd_icon} />
            </span>
          </Button>
          <Button.Or />
          <Button toggle active={is_noob}>
            I'm a <Icon style={{ marginLeft: 0.1 + "em" }} name={noob_icon} />
          </Button>
        </Button.Group>
      </Card>
    );
  }
  // TODO: loading, error
  return (
    <>
      Loading...
    </>);
}
