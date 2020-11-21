import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
  dialogTitle: {
    paddingBottom: theme.spacing(1),
  },
  dialogText: {
    marginBottom: 0,
  },
}),
);

export default function EditTalkDialog({ open, onClose, onCreateAsNerd, onCreateAsNoob }) {
  const classes = useStyles();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
    }
  }, [open]);

  return <Dialog open={open} onClose={onClose}>
    <DialogTitle className={classes.dialogTitle}>Create talk</DialogTitle>
    <DialogContent>
      <DialogContentText className={classes.dialogText}>Enter new title and description:</DialogContentText>
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
    </DialogContent>
    <DialogActions>
      <Button
        onClick={onClose}
      >
        Cancel
      </Button>
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
  </Dialog>;
};
