import React, { useState, useEffect } from "react";
import { Card, Icon, Button } from "semantic-ui-react";
import { useCollection, useDocument } from "react-firebase-hooks/firestore";

const nerd_icon = "graduation cap";
const noob_icon = "blind";

// TODO: Don't allow is_nerd && is_noob
const is_nerd = false;
const is_noob = false;

function Name({ documentReference }) {
  const [user, userLoading, userError] = useDocument(documentReference);
  if (user) {
    return (
      <>
        {user.data().name}
      </>
    );
  }
  return (
    <>
      Loading...
    </>
  );
}

export default function TalkCard({ talk }) {
  // const [nerdStrings, setNerdStrings] = 
  // useEffect(async () => {
    
  // }, [talk.nerds]);
  // console.log(talk.nerds.map(async nerd => await nerd.get()));
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
        <b>Nerds</b>: {talk.nerds.map((nerd, index, array) =>
          <><Name documentReference={nerd} />{index < array.length && <>, </>}</>)}
        <br />
        <Icon name={noob_icon} />
        <b>Noobs</b>: {talk.noobs.map(noob => <Name documentReference={noob} />).join(", ")}
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
