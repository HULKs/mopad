import React from "react";
import { Button, Icon, Card, Placeholder } from "semantic-ui-react";

const nerdIcon = "graduation cap";
const noobIcon = "earlybirds";

export default function PlaceholderCard() {
  return (
    <Card raised>
      <Card.Content>
        <Card.Header>
          <Placeholder>
            <Placeholder.Line />
          </Placeholder>
        </Card.Header>
        <Card.Meta>
          <Placeholder>
            <Placeholder.Line length="short" />
          </Placeholder>
        </Card.Meta>
      </Card.Content>
      <Card.Content style={{ height: 100 + "%" }}>
        <Card.Description>
          <Placeholder>
            <Placeholder.Paragraph>
              <Placeholder.Line />
              <Placeholder.Line />
              <Placeholder.Line length="short" />
              <Placeholder.Line />
              <Placeholder.Line length="short" />
            </Placeholder.Paragraph>
          </Placeholder>
        </Card.Description>
      </Card.Content>
      <Card.Content>
        <Placeholder>
          <Placeholder.Line length="medium" />
          <Placeholder.Line length="medium" />
        </Placeholder>
      </Card.Content>
      <Button.Group size="medium">
        <Button disabled>
          Join as <Icon style={{ marginLeft: 0.1 + "em" }} name={nerdIcon} />
        </Button>
        <Button.Or />
        <Button disabled>
          Join as <Icon style={{ marginLeft: 0.1 + "em" }} name={noobIcon} />
        </Button>
      </Button.Group>
    </Card>
  );
}
