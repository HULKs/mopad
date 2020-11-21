import React, { useState } from "react";
import Moment from "react-moment";
import firebase from "firebase/app";
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Grid,
  IconButton,
  Snackbar,
  Tooltip,
  Typography,
} from "@material-ui/core";
import DescriptionIcon from "@material-ui/icons/Description";
import EditIcon from "@material-ui/icons/Edit";
import EventIcon from "@material-ui/icons/Event";
import PeopleIcon from "@material-ui/icons/People";
import { makeStyles } from "@material-ui/core/styles";

import EditTalkDialog from "./EditTalkDialog";
import UserNameWithTeam from "./UserNameWithTeam";

const useStyles = makeStyles((theme) => ({
  primaryBackground: {
    backgroundColor: theme.palette.primary.light,
  },
  secondaryBackground: {
    backgroundColor: theme.palette.secondary.light,
  },
  cardContent: {
    paddingBottom: 0,
  },
  editButton: {
    float: "right",
    marginTop: theme.spacing(-2),
    marginRight: theme.spacing(-2),
  },
  cardTitle: {
    overflowWrap: "break-word",
  },
  cardSection: {
    marginTop: theme.spacing(1.75),
    overflowWrap: "anywhere",
  },
  cardSectionIcon: {
    marginRight: theme.spacing(1.3),
    color: theme.palette.text.secondary,
  },
  cardSectionText: {
    paddingTop: theme.spacing(0.25),
  },
  cardSectionTypography: {
    paddingTop: theme.spacing(0.25),
    paddingBottom: theme.spacing(0.5),
    lineHeight: 1.3,
  },
  cardSectionPeopleLabel: {
    marginRight: theme.spacing(0.5),
  },
  cardActions: {
    justifyContent: "flex-end",
  },
}));

function arrayToNameList(array, userId, users, teams) {
  const itemToComponent = (item) => (
    <UserNameWithTeam
      key={item.id}
      userName={users[item.id].name}
      teamName={teams[users[item.id].team.id].name}
      isYou={item.id === userId}
    />
  );

  return [
    ...array.filter((item) => item.id === userId),
    ...array.filter((item) => item.id !== userId),
  ].reduce(
    (array, item, index) =>
      index === 0
        ? [...array, itemToComponent(item)]
        : [
            ...array,
            <React.Fragment key={index}>{", "}</React.Fragment>,
            itemToComponent(item),
          ],
    []
  );
}

async function switchOrDisable(
  talkId,
  isEnabled,
  selfArray,
  otherArray,
  userId
) {
  if (isEnabled) {
    await firebase
      .firestore()
      .doc(`talks/${talkId}`)
      .update({
        [selfArray]: firebase.firestore.FieldValue.arrayRemove(
          firebase.firestore().doc(`users/${userId}`)
        ),
      });
  } else {
    await firebase
      .firestore()
      .doc(`talks/${talkId}`)
      .update({
        [selfArray]: firebase.firestore.FieldValue.arrayUnion(
          firebase.firestore().doc(`users/${userId}`)
        ),
        [otherArray]: firebase.firestore.FieldValue.arrayRemove(
          firebase.firestore().doc(`users/${userId}`)
        ),
      });
  }
}

async function updateTitleAndDescription(
  talkId,
  setShowEditDialog,
  setEditError,
  title,
  description
) {
  setShowEditDialog(false);
  try {
    await firebase.firestore().doc(`talks/${talkId}`).update({
      title: title,
      description: description,
    });
  } catch (error) {
    console.error(error);
    setEditError(error);
  }
}

async function updateScheduledAtAndDurationAndLocation(
  talkId,
  setShowEditDialog,
  setEditError,
  scheduledAt,
  duration,
  location
) {
  setShowEditDialog(false);
  try {
    await firebase
      .firestore()
      .doc(`talks/${talkId}`)
      .update({
        scheduledAt: scheduledAt
          ? firebase.firestore.Timestamp.fromDate(scheduledAt)
          : firebase.firestore.FieldValue.delete(),
        duration: scheduledAt
          ? duration
          : firebase.firestore.FieldValue.delete(),
        location: scheduledAt
          ? location
          : firebase.firestore.FieldValue.delete(),
      });
  } catch (error) {
    console.error(error);
    setEditError(error);
  }
}

async function deleteTalk(talkId, setShowEditDialog, setEditError) {
  setShowEditDialog(false);
  try {
    await firebase.firestore().doc(`talks/${talkId}`).delete();
  } catch (error) {
    console.error(error);
    setEditError(error);
  }
}

export default function TalkCard({ talkId, talk, userId, user, users, teams }) {
  const classes = useStyles();

  const nerds = arrayToNameList(talk.nerds, userId, users, teams);
  const noobs = arrayToNameList(talk.noobs, userId, users, teams);

  const isNerd = talk.nerds.some((nerd) => nerd.id === userId);
  const isNoob = talk.noobs.some((noob) => noob.id === userId);

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editError, setEditError] = useState();

  const isDeletable = user.roles.includes("editor");
  const isEditable =
    talk.creator.id === userId || isDeletable;
  const isSchedulable = user.roles.includes("scheduler");

  return (
    <Grid xs={12} sm={6} md={4} lg={3} xl={2} item>
      <Card elevation={isNerd || isNoob ? 8 : 1}>
        {(isEditable || isSchedulable) && (
          <>
            <EditTalkDialog
              talkId={talkId}
              talk={talk}
              isDeletable={isDeletable}
              isEditable={isEditable}
              isSchedulable={isSchedulable}
              open={showEditDialog}
              onClose={() => setShowEditDialog(false)}
              onEditUpdate={async (title, description) =>
                await updateTitleAndDescription(
                  talkId,
                  setShowEditDialog,
                  setEditError,
                  title,
                  description
                )
              }
              onScheduleUpdate={async (scheduledAt, duration, location) =>
                await updateScheduledAtAndDurationAndLocation(
                  talkId,
                  setShowEditDialog,
                  setEditError,
                  scheduledAt,
                  duration,
                  location
                )
              }
              onDelete={async () =>
                await deleteTalk(talkId, setShowEditDialog, setEditError)
              }
            />
            <Snackbar
              anchorOrigin={{ vertical: "top", horizontal: "center" }}
              open={editError ? true : false}
              autoHideDuration={10000}
              onClose={() => setEditError()}
              message={
                editError ? `${editError.name}: ${editError.message}` : "..."
              }
            />
          </>
        )}
        <CardContent className={classes.cardContent}>
          {(isEditable || isSchedulable) && (
            <Tooltip title="Edit talk" className={classes.editButton}>
              <IconButton onClick={() => setShowEditDialog(true)}>
                <EditIcon />
              </IconButton>
            </Tooltip>
          )}
          <Typography variant="h6" className={classes.cardTitle}>
            {talk.title}
          </Typography>
          {"scheduledAt" in talk && "duration" in talk && "location" in talk && (
            <Grid container className={classes.cardSection} wrap="nowrap">
              <Grid item className={classes.cardSectionIcon}>
                <EventIcon color="inherit" />
              </Grid>
              <Grid item className={classes.cardSectionText}>
                <Typography variant="body2" color="textSecondary">
                  <Tooltip
                    title={<Moment local>{talk.scheduledAt.toDate()}</Moment>}
                  >
                    <Moment fromNow local>
                      {talk.scheduledAt.toDate()}
                    </Moment>
                  </Tooltip>
                </Typography>
                {/* {" "}for {Math.round(talk.duration / 60)} minutes */}
                <Typography variant="body2" color="textSecondary">
                  {talk.location}
                </Typography>
              </Grid>
            </Grid>
          )}
          <Grid container className={classes.cardSection} wrap="nowrap">
            <Grid item className={classes.cardSectionIcon}>
              <DescriptionIcon color="inherit" />
            </Grid>
            <Grid item className={classes.cardSectionText}>
              {talk.description.split("\n").map((line, index) => (
                <Typography
                  className={classes.cardSectionTypography}
                  key={index}
                  variant="body2"
                  color="textSecondary"
                >
                  {line}
                </Typography>
              ))}
            </Grid>
          </Grid>
          <Grid container className={classes.cardSection} wrap="nowrap">
            <Grid item className={classes.cardSectionIcon}>
              <PeopleIcon color="inherit" />
            </Grid>
            <Grid item className={classes.cardSectionText}>
              <Grid container wrap="nowrap">
                <Grid item className={classes.cardSectionPeopleLabel}>
                  <Typography variant="body2" color="textSecondary">
                    Nerds ({talk.nerds.length}):
                  </Typography>
                </Grid>
                <Grid item>
                  <Typography variant="body2" color="textSecondary">
                    {nerds}
                  </Typography>
                </Grid>
              </Grid>
              <Grid container wrap="nowrap">
                <Grid item className={classes.cardSectionPeopleLabel}>
                  <Typography variant="body2" color="textSecondary">
                    Noobs ({talk.noobs.length}):
                  </Typography>
                </Grid>
                <Grid item>
                  <Typography variant="body2" color="textSecondary">
                    {noobs}
                  </Typography>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </CardContent>
        <CardActions className={classes.cardActions}>
          <Button
            variant={isNoob ? "contained" : undefined}
            color="primary"
            onClick={async () =>
              switchOrDisable(talkId, isNoob, "noobs", "nerds", userId)
            }
          >
            Noob
          </Button>
          <Button
            variant={isNerd ? "contained" : undefined}
            color="primary"
            onClick={async () =>
              switchOrDisable(talkId, isNerd, "nerds", "noobs", userId)
            }
          >
            Nerd
          </Button>
        </CardActions>
      </Card>
    </Grid>
  );
}
