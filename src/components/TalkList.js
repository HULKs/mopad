import React, { useState } from "react";
import firebase from "firebase/app";
import {
  Button,
  Container,
  Fab,
  Grid,
  IconButton,
  // InputBase,
  // Paper,
  Tooltip,
  Typography,
  Snackbar,
} from "@material-ui/core";
import AddIcon from "@material-ui/icons/Add";
import EventIcon from "@material-ui/icons/Event";
// import SearchIcon from "@material-ui/icons/Search";
import { makeStyles } from "@material-ui/core/styles";

import CreateTalkDialog from "./CreateTalkDialog";
import ExportTalkCalendarDialog from "./ExportTalkCalendarDialog";
import TalkCard from "./TalkCard";
import usePartitionedTalks from "../hooks/usePartitionedTalks";

const useStyles = makeStyles(theme => ({
  titleContainer: {
    marginTop: theme.spacing(3.75),
    marginBottom: theme.spacing(2),
  },
  title: {
    marginRight: theme.spacing(2),
  },
  cardContainer: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(4),
  },
  floatingActionButton: {
    position: "fixed",
    right: theme.spacing(4),
    bottom: theme.spacing(4),
  },
  userContainer: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  legalContainer: {
    marginBottom: theme.spacing(2),
    textAlign: "center",
  },
}));

async function createTalk(setShowCreateDialog, setCreateError, userId, isNerd, title, description) {
  setShowCreateDialog(false);
  try {
    await firebase
      .firestore()
      .collection("talks")
      .add({
        createdAt: firebase.firestore.Timestamp.now(),
        creator: firebase.firestore().doc(`users/${userId}`),
        description: description,
        nerds: isNerd ? [firebase.firestore().doc(`users/${userId}`)] : [],
        noobs: !isNerd ? [firebase.firestore().doc(`users/${userId}`)] : [],
        title: title,
      });
  } catch (error) {
    console.error(error);
    setCreateError(error);
  }
}

export default function TalkList({ userId, user, users, talks, teams }) {
  const classes = useStyles();

  const renderTalkCardFromTalk = ([talkId, talk]) => <TalkCard
    key={talkId}
    talkId={talkId}
    talk={talk}
    userId={userId}
    user={user}
    users={users}
    teams={teams}
  />;

  const [pastScheduledTalks, currentScheduledTalks, upcomingScheduledTalks, unscheduledTalks] = usePartitionedTalks(talks);

  const renderTalkSection = (title, talkList) => <>
    {talkList.length > 0 && <>
      <Container maxWidth="md">
        <Typography variant="h5">
          {title}
        </Typography>
      </Container>
      <Container maxWidth={talkList.length > 0 ? false : "md"} className={classes.cardContainer}>
        <Grid container spacing={2}>{talkList}</Grid>
      </Container>
    </>}
  </>;

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createError, setCreateError] = useState();

  const [showEventCalendarDialog, setShowEventCalendarDialog] = useState(false);

  return <>
    <CreateTalkDialog
      open={showCreateDialog}
      onClose={() => setShowCreateDialog(false)}
      onCreateAsNerd={async (title, description) =>
        await createTalk(setShowCreateDialog, setCreateError, userId, true, title, description)}
      onCreateAsNoob={async (title, description) =>
        await createTalk(setShowCreateDialog, setCreateError, userId, false, title, description)}
    />
    <Snackbar
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      open={createError ? true : false}
      autoHideDuration={6000}
      onClose={() => setCreateError()}
      message={createError ? `${createError.name}: ${createError.message}` : "..."}
    />
    <Fab
      color="primary"
      className={classes.floatingActionButton}
      onClick={() => setShowCreateDialog(true)}
    >
      <AddIcon />
    </Fab>
    <ExportTalkCalendarDialog
      userId={userId}
      open={showEventCalendarDialog}
      onClose={() => setShowEventCalendarDialog(false)}
    />
    <Container maxWidth="md" className={classes.titleContainer}>
      <Grid container alignItems="center">
        <Grid item className={classes.title}>
          <Typography variant="h3">
            MOPAD
          </Typography>
        </Grid>
        {/* <Grid item>
          <Paper>
            <Grid container>
              <Grid item>
                <IconButton>
                  <SearchIcon />
                </IconButton>
              </Grid>
              <Grid item>
                <InputBase
                  placeholder="Search"
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid> */}
        <Grid item>
          <Tooltip title="Export talk calendar (iCal)">
            <IconButton color="inherit" onClick={() => setShowEventCalendarDialog(true)}>
              <EventIcon />
            </IconButton>
          </Tooltip>
        </Grid>
        {/* <Grid item>
          <Tooltip title="RoHOW Website">
            <IconButton color="inherit">
              <LaunchIcon />
            </IconButton>
          </Tooltip>
        </Grid> */}
      </Grid>
    </Container>
    {renderTalkSection("Past talks", pastScheduledTalks.map(renderTalkCardFromTalk))}
    {renderTalkSection("Current talks", currentScheduledTalks.map(renderTalkCardFromTalk))}
    {renderTalkSection("Upcoming talks", upcomingScheduledTalks.map(renderTalkCardFromTalk))}
    {renderTalkSection("Unscheduled talks", unscheduledTalks.map(renderTalkCardFromTalk))}
    <Container maxWidth="md" className={classes.userContainer}>
      <Grid container alignItems="center" justify="center">
        <Grid item>
          <Typography>
            Moin {user.name}!
          </Typography>
        </Grid>
        <Grid item>
          <Button onClick={async () => {
            await firebase.auth().signOut();
          }}>
            Logout
          </Button>
        </Grid>
      </Grid>
    </Container>
    <Container maxWidth="md" className={classes.legalContainer}>
      <Typography variant="body2" color="textSecondary">
        TODO: GDPR
      </Typography>
    </Container>
  </>;
}
