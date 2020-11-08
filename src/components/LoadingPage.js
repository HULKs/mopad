import React from "react";

import { Container, Dimmer, Loader } from "semantic-ui-react";

export default function LoadingPage() {
  return (
    <Container>
      <Dimmer.Dimmable dimmed>
        <Dimmer active inverted>
          <Loader size="large">Loading</Loader>
        </Dimmer>
        <Container style={{ height: "50vh" }} />
      </Dimmer.Dimmable>
    </Container>
  );
}
