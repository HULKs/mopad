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
import {
  DateTimePicker,
} from "@material-ui/pickers";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
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

export default function EditTalkDialog({ talk, isEditable, isSchedulable, open, onClose, onEditUpdate, onScheduleUpdate, onDelete }) {
  const classes = useStyles();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState(null);
  const [duration, setDuration] = useState(600);
  const [location, setLocation] = useState("");

  useEffect(() => {
    setTitle(talk.title);
    setDescription(talk.description);
    setScheduledAt(talk.scheduledAt ? talk.scheduledAt.toDate() : null);
    setDuration(talk.duration ? talk.duration : 600);
    setLocation(talk.location ? talk.location : "");
  }, [talk]);

  return <Dialog open={open} onClose={onClose}>
    <DialogTitle className={classes.title}>Edit talk</DialogTitle>
    <DialogContent>
      {isEditable && <>
        <DialogContentText className={classes.sectionTextTitle}>Enter new title and description:</DialogContentText>
        <TextField
          label="Talk Title"
          variant="outlined"
          margin="normal"
          fullWidth
          value={title}
          onChange={event => setTitle(event.target.value)}
        />
        <TextField
          label="Talk Description"
          variant="outlined"
          margin="normal"
          fullWidth
          value={description}
          onChange={event => setDescription(event.target.value)}
          multiline
        />
      </>}
      {isSchedulable && <>
        <DialogContentText className={classes.sectionTextTitle}>Select whether and when this talk is scheduled:</DialogContentText>
        <DateTimePicker
          clearable
          ampm={false}
          inputVariant="outlined"
          fullWidth
          value={scheduledAt}
          onChange={setScheduledAt}
          label="Scheduled date and time"
          showTodayButton
          margin="normal"
        />
        {scheduledAt && <>
          <DialogContentText className={classes.sectionTextTitle}>Select talk duration:</DialogContentText>
          <Slider
            margin="normal"
            value={duration}
            onChange={(event, newDuration) => setDuration(newDuration)}
            marks={[
              { value: 30 * 60, label: "0:30" },
              { value: 60 * 60, label: "1:00" },
              { value: 60 * 60 + 30 * 60, label: "1:30" },
              { value: 2 * 60 * 60, label: "2:00" },
            ]}
            step={5 * 60}
            valueLabelDisplay="auto"
            valueLabelFormat={value => `${Math.round(value / 60)}`}
            min={0}
            max={2 * 60 * 60}
          />
          <TextField
            label="Talk Location"
            variant="outlined"
            margin="normal"
            fullWidth
            value={location}
            onChange={event => setLocation(event.target.value)}
          />
        </>}
      </>}
    </DialogContent>
    <DialogActions>
      {isEditable && <Button
        className={classes.deleteButton}
        onClick={onDelete}
      >
        Delete
      </Button>}
      <Button
        onClick={onClose}
      >
        Cancel
      </Button>
      <Button
        color="primary"
        onClick={async () => {
          if (isEditable) {
            await onEditUpdate(title, description);
          }
          if (isSchedulable) {
            await onScheduleUpdate(scheduledAt, duration, location);
          }
        }}
      >
        Update
      </Button>
    </DialogActions>
  </Dialog>;
};