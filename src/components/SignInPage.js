import React, { useState } from "react";
import firebase from "firebase/app";
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import PermIdentityIcon from "@material-ui/icons/PermIdentity";
import LockOutlinedIcon from "@material-ui/icons/LockOutlined";

const useStyles = makeStyles((theme) => ({
  errorMessage: {
    backgroundColor: theme.palette.error.main,
  },
  loadingBox: {
    textAlign: "center",
  },
  loadingText: {
    marginTop: theme.spacing(1),
  },
  title: {
    textAlign: "center",
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(0.25),
  },
  subtitle: {
    textAlign: "center",
    marginTop: theme.spacing(0.25),
    marginBottom: theme.spacing(4),
  },
  avatar: {
    textAlign: "center",
    backgroundColor: theme.palette.primary.main,
  },
  subsubtitle: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  formTitle: {
    marginBottom: theme.spacing(1),
  },
  button: {
    marginTop: theme.spacing(3),
  },
  signUp: {
    marginTop: theme.spacing(2),
  },
  footer: {
    textAlign: "center",
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(2),
  },
}));

export default function SignInPage({ teams }) {
  const classes = useStyles();

  const [showLogin, setShowLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [password, setPassword] = useState("");
  const [notARobot, setNotARobot] = useState(false);
  const [error, setError] = useState();

  if (loading) {
    return (
      <Box m={8} className={classes.loadingBox}>
        <CircularProgress />
        <Typography className={classes.loadingText}>
          Connecting to LoLA...
        </Typography>
      </Box>
    );
  }

  const form = showLogin ? (
    <>
      <Grid item>
        <TextField
          label="Your Name"
          variant="outlined"
          margin="normal"
          fullWidth
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Grid>
      <Grid item>
        <FormControl variant="outlined" margin="normal" fullWidth>
          <InputLabel id="team-select-label">Your Team</InputLabel>
          <Select
            labelId="team-select-label"
            value={team}
            onChange={(event) => setTeam(event.target.value)}
            label="Your Team"
          >
            {Object.entries(teams).map(([teamId, team]) => (
              <MenuItem key={teamId} value={teamId}>
                {team.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item>
        <TextField
          label="Password"
          variant="outlined"
          margin="normal"
          fullWidth
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Grid>
      <Grid item className={classes.button}>
        <Button
          disabled={!name || !team || !password}
          color="primary"
          fullWidth
          variant="contained"
          onClick={async () => {
            setLoading(true);
            try {
              const userId = Array.from(`${team}:${name}`, (byte) =>
                byte.charCodeAt(0).toString(16).padStart(2, "0")
              ).join("");
              await firebase
                .auth()
                .signInWithEmailAndPassword(`${userId}@mopad.app`, password);
            } catch (error) {
              switch (error.code) {
                case "auth/invalid-email": {
                  setError("Failed to login: Your name is too long");
                  break;
                }
                case "auth/user-disabled": {
                  setError("Failed to login: You have been disabled");
                  break;
                }
                case "auth/user-not-found":
                case "auth/wrong-password": {
                  setError("Failed to login: User, team or password wrong");
                  break;
                }
                default: {
                  setError(`Failed to login: ${error.name}, ${error.message}`);
                  break;
                }
              }
              setLoading(false);
            }
          }}
        >
          Login
        </Button>
      </Grid>
    </>
  ) : (
      <>
        <Grid item>
          <TextField
            label="Your Name"
            variant="outlined"
            margin="normal"
            fullWidth
            value={name}
            onChange={(event) => setName(event.target.value)}
            helperText="Unique within your team, visible to everyone"
          />
        </Grid>
        <Grid item>
          <FormControl variant="outlined" margin="normal" fullWidth>
            <InputLabel id="team-select-label">Your Team</InputLabel>
            <Select
              labelId="team-select-label"
              value={team}
              onChange={(event) => setTeam(event.target.value)}
              label="Your Team"
            >
              {Object.entries(teams).map(([teamId, team]) => (
                <MenuItem key={teamId} value={teamId}>
                  {team.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>Visible to everyone</FormHelperText>
          </FormControl>
        </Grid>
        <Grid item>
          <TextField
            label="Password"
            variant="outlined"
            margin="normal"
            fullWidth
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Grid>
        <Grid item>
          <FormControlLabel
            control={
              <Checkbox
                checked={notARobot}
                onChange={(event) => setNotARobot(event.target.checked)}
                color="primary"
              />
            }
            label="I'm not a NAO"
          />
        </Grid>
        <Grid item className={classes.button}>
          <Button
            disabled={!name || !team || !password || !notARobot}
            color="primary"
            fullWidth
            variant="contained"
            onClick={async () => {
              setLoading(true);
              try {
                const userId = Array.from(`${team}:${name}`, (byte) =>
                  byte.charCodeAt(0).toString(16).padStart(2, "0")
                ).join("");
                const {
                  user,
                } = await firebase
                  .auth()
                  .createUserWithEmailAndPassword(
                    `${userId}@mopad.app`,
                    password
                  );
                await firebase
                  .firestore()
                  .collection("users")
                  .doc(userId)
                  .set(
                    {
                      name: name,
                      team: firebase.firestore().doc(`teams/${team}`),
                      roles: [],
                      authenticationId: user.uid,
                    },
                    {
                      merge: true,
                    }
                  );
              } catch (error) {
                switch (error.code) {
                  case "auth/email-already-in-use": {
                    setError("Failed to register: You are already registered in this team");
                    break;
                  }
                  case "auth/invalid-email": {
                    setError("Failed to register: Your name is too long");
                    break;
                  }
                  case "auth/weak-password": {
                    setError("Failed to register: Password too weak");
                    break;
                  }
                  default: {
                    setError(`Failed to register: ${error.name}, ${error.message}`);
                    break;
                  }
                }
                setLoading(false);
              }
            }}
          >
            Register
        </Button>
        </Grid>
      </>
    );

  return (
    <Container maxWidth="xs">
      <Snackbar
        ContentProps={{
          className: classes.errorMessage,
        }}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        open={error ? true : false}
        autoHideDuration={10000}
        onClose={() => setError()}
        message={error ? error : "..."}
      />
      <Grid container direction="column">
        <Grid item className={classes.title}>
          <Typography variant="h3">MOPAD</Typography>
        </Grid>
        <Grid item className={classes.subtitle}>
          <Typography variant="body2" color="textSecondary">
            Moderated Organization PAD (powerful, agile, distributed)
          </Typography>
        </Grid>
        <Grid item className={classes.formTitle}>
          <Grid container alignItems="center" justify="center">
            <Grid item>
              <Avatar className={classes.avatar}>
                {showLogin ? <LockOutlinedIcon /> : <PermIdentityIcon />}
              </Avatar>
            </Grid>
            <Grid item className={classes.subsubtitle}>
              <Typography variant="h5">
                {showLogin ? "Login" : "Register"}
              </Typography>
            </Grid>
          </Grid>
        </Grid>
        {form}
        <Grid item className={classes.signUp}>
          <Grid container alignItems="center" justify="center">
            <Grid item>
              <Typography>
                {showLogin
                  ? "Don't have an account?"
                  : "Already have an account?"}
              </Typography>
            </Grid>
            <Grid item>
              <Button onClick={() => setShowLogin(!showLogin)}>
                {showLogin ? "Register" : "Login"}
              </Button>
            </Grid>
          </Grid>
        </Grid>
        <Grid item className={classes.footer}>
          <Typography variant="body2" color="textSecondary">
            TODO: GDPR
          </Typography>
        </Grid>
      </Grid>
    </Container>
  );
}
