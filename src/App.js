import React from "react";

import useTalks from "./hooks/useTalks";
import useTeams from "./hooks/useTeams";
import useUser from "./hooks/useUser";
import useUsers from "./hooks/useUsers";

import TalkList from "./components/TalkList";
import SignInPage from "./components/SignInPage";

import {
  Container,
  Typography,
  CircularProgress,
  Box,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles({
  loadingBox: {
    textAlign: "center",
  }
});

export default function App() {
  const classes = useStyles();
  const [users, usersLoading, usersError] = useUsers();
  const [userId, user, userLoading, userError] = useUser(users, usersLoading, usersError);
  const [teams, teamsLoading, teamsError] = useTeams();
  const [talks, talksLoading, talksError] = useTalks();

  if (usersError || userError || teamsError || talksError) {
    return <Container maxWidth="lg">
      <Typography variant="h5">Users Error</Typography>
      <Typography color="error">{JSON.stringify(usersError)}</Typography>
      <Typography variant="h5">User Error</Typography>
      <Typography color="error">{JSON.stringify(userError)}</Typography>
      <Typography variant="h5">Teams Error</Typography>
      <Typography color="error">{JSON.stringify(teamsError)}</Typography>
      <Typography variant="h5">Talks Error</Typography>
      <Typography color="error">{JSON.stringify(talksError)}</Typography>
    </Container>;
  }

  if (usersLoading || userLoading || teamsLoading || talksLoading) {
    return <Box m={8} className={classes.loadingBox}>
      <CircularProgress />
      <Typography style={{ marginTop: "1rem" }}>
        Booting chestboard...
      </Typography>
    </Box>;
  }

  if (!user) {
    return <SignInPage teams={teams} />;
  }

  return <TalkList
    userId={userId}
    user={user}
    users={users}
    talks={talks}
    teams={teams}
  />;
}
