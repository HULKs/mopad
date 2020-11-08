import React from "react";
import { Card, Container } from "semantic-ui-react";
import DashboardMenu from "./DashboardMenu";
import PlaceholderCard from "./PlaceholderCard";

export default function LoadingDashboard() {
  return (
    <>
      <DashboardMenu />
      <Container style={{ width: "90%" }}>
        <Card.Group stackable>
          {Array.from({ length: 5 }, (_, i) => (
            <PlaceholderCard key={i} />
          ))}
        </Card.Group>
      </Container>
    </>
  );
}
