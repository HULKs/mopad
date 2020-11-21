import React, { useState, useEffect } from "react";
import firebase from "firebase/app";
import {
  Button,
  Container,
  Fab,
  Grid,
  IconButton,
  InputBase,
  Paper,
  Tooltip,
  Typography,
  Snackbar,
} from "@material-ui/core";
import AddIcon from "@material-ui/icons/Add";
import EventIcon from "@material-ui/icons/Event";
import SearchIcon from "@material-ui/icons/Search";
import { makeStyles } from "@material-ui/core/styles";

import CreateTalkDialog from "./CreateTalkDialog";
import ExportTalkCalendarDialog from "./ExportTalkCalendarDialog";
import TalkCard from "./TalkCard";
import usePartitionedTalks from "../hooks/usePartitionedTalks";

import waiting from "./waiting.gif";

const useStyles = makeStyles((theme) => ({
  titleContainer: {
    marginTop: theme.spacing(3.75),
    marginBottom: theme.spacing(2),
  },
  waitingContainer: {
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(2),
    textAlign: "center",
  },
  sectionCollapseButton: {
    marginLeft: "auto",
  },
  sectionHeadingContainer: {
    marginBottom: theme.spacing(2),
  },
  cardContainer: {
    marginBottom: theme.spacing(4),
  },
  floatingActionButton: {
    zIndex: (theme.zIndex.appBar + theme.zIndex.drawer) / 2,
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
  legalContainerLinks: {
    color: theme.palette.primary.main,
  },
  fullWidthGridItem: {
    flexGrow: 1,
  },
}));

async function createTalk(
  setShowCreateDialog,
  setCreateError,
  userId,
  isNerd,
  title,
  description,
  duration
) {
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
        duration: duration,
      });
  } catch (error) {
    console.error(error);
    setCreateError(error);
  }
}

export default function TalkList({ userId, user, users, talks, teams }) {
  const classes = useStyles();

  const renderTalkCardFromTalk = ([talkId, talk]) => (
    <TalkCard
      key={talkId}
      talkId={talkId}
      talk={talk}
      userId={userId}
      user={user}
      users={users}
      teams={teams}
    />
  );

  const [searchInputText, setSearchInputText] = useState("");
  const [searchWords, setSearchWords] = useState([]);
  const [filteredTalks, setFilteredTalks] = useState([]);

  useEffect(() => {
    setFilteredTalks(
      searchWords.length !== 0
        ? talks.filter(([, talk]) =>
          searchWords.some(
            (word) =>
              talk.description.toLowerCase().includes(word.toLowerCase()) ||
              talk.title.toLowerCase().includes(word.toLowerCase())
          )
        )
        : talks
    );
  }, [talks, searchWords]);

  const [
    pastScheduledTalks,
    currentScheduledTalks,
    upcomingScheduledTalks,
    unscheduledTalks,
  ] = usePartitionedTalks(filteredTalks);

  const [pastScheduledTalksExpanded, setPastScheduledTalksExpanded] = useState(false);
  const [currentScheduledTalksExpanded, setCurrentScheduledTalksExpanded] = useState(true);
  const [upcomingScheduledTalksExpanded, setUpcomingScheduledTalksExpanded] = useState(true);
  const [unscheduledScheduledTalksExpanded, setUnscheduledScheduledTalksExpanded] = useState(true);

  const renderTalkSection = (expanded, setExpanded, title, talkList) => (
    <>
      {talkList.length > 0 && (
        <>
          <Container
            maxWidth="md"
            className={classes.sectionHeadingContainer}
          >
            <Grid container alignItems="center">
              <Grid item>
                <Typography variant="h5">{title}</Typography>
              </Grid>
              <Grid item className={classes.sectionCollapseButton}>
                <Button onClick={() => setExpanded(!expanded)}>Show {expanded ? "less" : "more"}</Button>
              </Grid>
            </Grid>
          </Container>
          {expanded &&
            <Container
              maxWidth={talkList.length > 0 ? false : "md"}
              className={classes.cardContainer}
            >
              <Grid container spacing={2}>
                {talkList}
              </Grid>
            </Container>
          }
        </>
      )}
    </>
  );

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createError, setCreateError] = useState();

  const [showEventCalendarDialog, setShowEventCalendarDialog] = useState(false);

  return (
    <>
      <CreateTalkDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreateAsNerd={async (title, description, duration) =>
          await createTalk(
            setShowCreateDialog,
            setCreateError,
            userId,
            true,
            title,
            description,
            duration
          )
        }
        onCreateAsNoob={async (title, description, duration) =>
          await createTalk(
            setShowCreateDialog,
            setCreateError,
            userId,
            false,
            title,
            description,
            duration
          )
        }
      />
      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        open={createError ? true : false}
        autoHideDuration={6000}
        onClose={() => setCreateError()}
        message={
          createError ? `${createError.name}: ${createError.message}` : "..."
        }
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
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <Typography variant="h3">MOPAD</Typography>
          </Grid>
          <Grid item>
            <Tooltip title="Export talk calendar (iCal)">
              <IconButton
                color="inherit"
                onClick={() => setShowEventCalendarDialog(true)}
              >
                <EventIcon />
              </IconButton>
            </Tooltip>
          </Grid>
          <Grid item className={classes.fullWidthGridItem}>
            <Paper>
              <Grid container>
                <Grid item>
                  <form
                    onSubmit={(e) => {
                      setSearchWords(searchInputText.split(" "));
                      e.preventDefault();
                    }}
                  >
                    <IconButton type="submit">
                      <SearchIcon />
                    </IconButton>
                    <InputBase
                      onChange={(e) => setSearchInputText(e.target.value)}
                      placeholder="Search"
                    />
                  </form>
                </Grid>
              </Grid>
            </Paper>
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
      {pastScheduledTalks.length === 0 &&
        currentScheduledTalks.length === 0 &&
        upcomingScheduledTalks.length === 0 &&
        unscheduledTalks.length === 0 &&
        <Container maxWidth="md" className={classes.waitingContainer}>
          <img src={waiting} alt="" />
        </Container>
      }
      {renderTalkSection(
        pastScheduledTalksExpanded,
        setPastScheduledTalksExpanded,
        "Past talks",
        pastScheduledTalks.map(renderTalkCardFromTalk)
      )}
      {renderTalkSection(
        currentScheduledTalksExpanded,
        setCurrentScheduledTalksExpanded,
        "Current talks",
        currentScheduledTalks.map(renderTalkCardFromTalk)
      )}
      {renderTalkSection(
        upcomingScheduledTalksExpanded,
        setUpcomingScheduledTalksExpanded,
        "Upcoming talks",
        upcomingScheduledTalks.map(renderTalkCardFromTalk)
      )}
      {renderTalkSection(
        unscheduledScheduledTalksExpanded,
        setUnscheduledScheduledTalksExpanded,
        "Unscheduled talks",
        unscheduledTalks.map(renderTalkCardFromTalk)
      )}
      <Container maxWidth="md" className={classes.userContainer}>
        <Grid container alignItems="center" justify="center">
          <Grid item>
            <Typography>Moin {user.name}!</Typography>
          </Grid>
          <Grid item>
            <Button
              onClick={async () => {
                await firebase.auth().signOut();
              }}
            >
              Logout
            </Button>
          </Grid>
        </Grid>
      </Container>
      <Container maxWidth="md" className={classes.legalContainer}>
        <Typography variant="body2" color="textSecondary">
          <a target="_blank" rel="noreferrer" href="https://rohow.de/2020/de/imprint.html" className={classes.legalContainerLinks}>Imprint/Impressum</a> – <a target="_blank" rel="noreferrer" href="https://rohow.de/2020/de/privacy_policy.html" className={classes.legalContainerLinks}>Privacy Policy/Datenschutzerklärung</a>
        </Typography>
      </Container>
    </>
  );
}
