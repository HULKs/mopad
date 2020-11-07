import React from "react";
import { Card, Placeholder } from "semantic-ui-react";
import TalkCard from "./TalkCard";
import EditableCard from "./EditableCard";
import firebase from "firebase";
import { useCollection, useDocument } from "react-firebase-hooks/firestore";

export default function CardGrid() {
  const [talks, talksLoading, talksError] = useCollection(
    firebase.firestore().collection("talks")
  );
  // TODO: loading, error
  console.log(talks, talksLoading, talksError);
  if (talks !== undefined) {
    return (
      <Card.Group>
        {talks.docs.map((talk) => (
          <TalkCard talk={talk.data()} />
        ))}
        <EditableCard />
      </Card.Group>
    );
  }
  return (
    <div>Loading</div>
    // <Card>
    //   <Card.Content>
    //     <Placeholder>
    //       <Placeholder.Paragraph>
    //         <Placeholder.Line length="medium">
    //         </Placeholder.Line>
    //       </Placeholder.Paragraph>
    //     </Placeholder>
    //   </Card.Content>
    // </Card>
  );
}
