import React, { useState, useEffect } from "react";
import { Card, Icon, Button } from "semantic-ui-react";
import { useCollection, useDocument } from "react-firebase-hooks/firestore";

const nerd_icon = "graduation cap";
const noob_icon = "blind";

// TODO: Don't allow is_nerd && is_noob
const is_nerd = false;
const is_noob = false;

function useReferences(refs) {
  const [values, setValues] = useState([]);
  useEffect(() => {
    (async () => {
      const resolvedRefs = await Promise.all(refs.map((ref) => ref.get()));
      setValues(resolvedRefs.map((it) => it.data()));
    })();
  }, [refs]);
  return values;
}

export default function TalkCard({ talk }) {
  const nerds = useReferences(talk.nerds);
  const noobs = useReferences(talk.noobs);

  return (
    <Card raised>
      <Card.Content>
        <Card.Header>{talk.title}</Card.Header>
      </Card.Content>
      <Card.Content style={{ height: 100 + "%" }}>
        <Card.Description>{talk.description}</Card.Description>
      </Card.Content>
      <Card.Content>
        <Icon name={nerd_icon} />
        <b>Nerds</b>: {nerds.map((it) => it.name).join(", ")}
        <br />
        <Icon name={noob_icon} />
        <b>Noobs</b>: {noobs.map((it) => it.name).join(", ")}
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
