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
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  dialogTitle: {
    paddingBottom: theme.spacing(1),
  },
  dialogText: {
    marginBottom: 0,
  },
  sectionTextTitle: {
    marginTop: theme.spacing(2),
  },
}));

export default function EditTalkDialog({
  open,
  onClose,
  onCreateAsNerd,
  onCreateAsNoob,
}) {
  const classes = useStyles();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(3600);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setDuration(3600);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle className={classes.dialogTitle}>Create talk</DialogTitle>
      <DialogContent>
        <DialogContentText className={classes.dialogText}>
          Enter new title and description:
        </DialogContentText>
        <TextField
          label="Talk Title"
          variant="outlined"
          margin="normal"
          fullWidth
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextField
          label="Talk Description"
          variant="outlined"
          margin="normal"
          fullWidth
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          multiline
        />
        <DialogContentText className={classes.sectionTextTitle}>
          Select talk duration:
        </DialogContentText>
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
          valueLabelFormat={(value) => `${Math.round(value / 60)}`}
          min={0}
          max={2 * 60 * 60}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          disabled={title.length === 0 || description.length === 0}
          color="primary"
          onClick={async () => {
            onCreateAsNoob(title, description);
          }}
        >
          Noob
        </Button>
        <Button
          disabled={title.length === 0 || description.length === 0}
          color="primary"
          onClick={async () => {
            onCreateAsNerd(title, description);
          }}
        >
          Nerd
        </Button>
      </DialogActions>
    </Dialog>
  );
}
