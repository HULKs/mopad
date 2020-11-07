import React from "react";
import { Input, Form, TextArea, Card, Button } from "semantic-ui-react";

export default function EditableCard() {
  return (
    <Card inverted>
      <Card.Content>
        <Card.Header>
          <Input transparent fluid placeholder="Talk Topic..." />
        </Card.Header>
      </Card.Content>
      <Card.Content>
        <Card.Description>
          <Form>
            <TextArea placeholder="What's your talk about?" />
          </Form>
        </Card.Description>
      </Card.Content>
      <Card.Content>
        <Button>Create</Button>
      </Card.Content>
    </Card>
  );
}
