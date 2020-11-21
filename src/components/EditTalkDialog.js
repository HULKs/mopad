import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Slider,
  TextField,
} from "@material-ui/core";
import { DateTimePicker } from "@material-ui/pickers";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  title: {
    paddingBottom: 0,
  },
  sectionTextTitle: {
    marginTop: theme.spacing(2),
  },
  deleteButton: {
    marginRight: "auto",
  },
}));

function updateStateFromTalk(
  talk,
  setTitle,
  setDescription,
  setScheduledAt,
  setDuration,
  setLocation
) {
  setTitle(talk.title);
  setDescription(talk.description);
  setScheduledAt("scheduledAt" in talk ? talk.scheduledAt.toDate() : null);
  setDuration(talk.duration);
  setLocation("location" in talk ? talk.location : "");
}

export default function EditTalkDialog({
  talk,
  isDeletable,
  isEditable,
  isSchedulable,
  open,
  onClose,
  onEditUpdate,
  onScheduleUpdate,
  onDelete,
}) {
  const classes = useStyles();

  const [dirty, setDirty] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState(null);
  const [duration, setDuration] = useState(3600);
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (!dirty) {
      updateStateFromTalk(
        talk,
        setTitle,
        setDescription,
        setScheduledAt,
        setDuration,
        setLocation
      );
    }
  }, [dirty, talk]);

  useEffect(() => {
    if (open) {
      setDirty(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle className={classes.title}>Edit talk</DialogTitle>
      <DialogContent>
        {isEditable && (
          <>
            <DialogContentText className={classes.sectionTextTitle}>
              Enter new title and description:
            </DialogContentText>
            <TextField
              label="Talk Title"
              variant="outlined"
              margin="normal"
              fullWidth
              value={title}
              onChange={(event) => {
                setDirty(true);
                setTitle(event.target.value);
              }}
            />
            <TextField
              label="Talk Description"
              variant="outlined"
              margin="normal"
              fullWidth
              value={description}
              onChange={(event) => {
                setDirty(true);
                setDescription(event.target.value);
              }}
              multiline
            />
          </>
        )}
        {isSchedulable && (
          <>
            <DialogContentText className={classes.sectionTextTitle}>
              Select whether and when this talk is scheduled:
            </DialogContentText>
            <DateTimePicker
              clearable
              ampm={false}
              inputVariant="outlined"
              fullWidth
              value={scheduledAt}
              onChange={(newScheduledAt) => {
                setDirty(true);
                setScheduledAt(newScheduledAt.toDate());
              }}
              label="Scheduled date and time"
              showTodayButton
              margin="normal"
            />
            {scheduledAt && (
              <TextField
                label="Talk Location"
                variant="outlined"
                margin="normal"
                fullWidth
                value={location}
                onChange={(event) => {
                  setDirty(true);
                  setLocation(event.target.value);
                }}
              />
            )}
          </>
        )}
        {(isEditable || isSchedulable) && (
          <>
            <DialogContentText className={classes.sectionTextTitle}>
              Select talk duration:
            </DialogContentText>
            <Slider
              margin="normal"
              value={duration}
              onChange={(event, newDuration) => {
                setDirty(true);
                setDuration(newDuration);
              }}
              marks={[
                { value: 30 * 60, label: "0:30" },
                { value: 60 * 60, label: "1:00" },
                { value: 60 * 60 + 30 * 60, label: "1:30" },
                { value: 2 * 60 * 60, label: "2:00" },
              ]}
              step={5 * 60}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${Math.round(value / 60)}`}
              min={0}
              max={2 * 60 * 60}
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        {isDeletable && (
          <Button className={classes.deleteButton} onClick={onDelete}>
            Delete
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button
          disabled={
            isEditable && (title.length === 0 || description.length === 0)
          }
          color="primary"
          onClick={async () => {
            if (isEditable) {
              await onEditUpdate(title, description, duration);
            }
            if (isSchedulable) {
              await onScheduleUpdate(scheduledAt, duration, location);
            }
          }}
        >
          Update
        </Button>
      </DialogActions>
    </Dialog>
  );
}
