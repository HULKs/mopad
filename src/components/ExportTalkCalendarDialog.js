import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Switch,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
  title: {
    paddingBottom: 0,
  },
  sectionTextTitle: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  link: {
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
  },
  sectionTextHint: {
    marginTop: theme.spacing(1),
  },
}));

export default function ExportTalkCalendarDialog({ userId, open, onClose }) {
  const classes = useStyles();

  const [onlySubscribedEvents, setOnlySubscribedEvents] = useState(true);

  return <Dialog open={open} onClose={onClose}>
    <DialogTitle className={classes.title}>Export talk calendar (iCal)</DialogTitle>
    <DialogContent>
      <DialogContentText className={classes.sectionTextTitle}>Use this address in external calendar applications to show {onlySubscribedEvents ? "your subscribed" : "the"} talks:</DialogContentText>
      <Typography variant="body2" className={classes.link}>
        <a
          target="_blank"
          rel="noreferrer"
          href={`${window.location}ical${onlySubscribedEvents ? `?user=${encodeURIComponent(userId)}` : ""}`}
        >
          {`${window.location}ical${onlySubscribedEvents ? `?user=${encodeURIComponent(userId)}` : ""}`}
        </a>
      </Typography>
      <FormControlLabel
        control={
          <Switch
            color="primary"
            checked={onlySubscribedEvents}
            onChange={event => setOnlySubscribedEvents(event.target.checked)}
          />
        }
        label="Only include your NERDed and NOOBed talks"
      />
      <DialogContentText className={classes.sectionTextHint}>The exported talk calendar will only contain scheduled talks.</DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button
        onClick={onClose}
      >
        Close
      </Button>
    </DialogActions>
  </Dialog>;
};
