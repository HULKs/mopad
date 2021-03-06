import React from "react";

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

const useStyles = makeStyles((theme) => ({
  loadingBox: {
    textAlign: "center",
  },
  loadingText: {
    marginTop: theme.spacing(1),
  },
}));

export default function App() {
  const classes = useStyles();
  const [users, usersLoading, usersError] = useUsers();
  const [userId, user, userLoading, userError] = useUser(
    users,
    usersLoading,
    usersError
  );
  const [teams, teamsLoading, teamsError] = useTeams();

  if (usersError || userError || teamsError) {
    return (
      <Container maxWidth="lg">
        <Typography variant="h5">Users Error</Typography>
        <Typography color="error">{JSON.stringify(usersError)}</Typography>
        <Typography variant="h5">User Error</Typography>
        <Typography color="error">{JSON.stringify(userError)}</Typography>
        <Typography variant="h5">Teams Error</Typography>
        <Typography color="error">{JSON.stringify(teamsError)}</Typography>
      </Container>
    );
  }

  if (usersLoading || userLoading || teamsLoading) {
    return (
      <Box m={8} className={classes.loadingBox}>
        <CircularProgress />
        <Typography className={classes.loadingText}>
          Booting chestboard...
        </Typography>
      </Box>
    );
  }

  if (!user) {
    return <SignInPage teams={teams} />;
  }

  return (
    <TalkList
      userId={userId}
      user={user}
      users={users}
      teams={teams}
    />
  );
}
