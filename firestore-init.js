const firebase = require("firebase/app");
require("firebase/auth");
require("firebase/firestore");

firebase.initializeApp({
  apiKey: "AIzaSyBm2uDgeqQfRqoXgDhz4psysK6n6PUWxdE",
  authDomain: "mopad-hulks.firebaseapp.com",
  databaseURL: "https://mopad-hulks.firebaseio.com",
  projectId: "mopad-hulks",
  storageBucket: "mopad-hulks.appspot.com",
  messagingSenderId: "65348878130",
  appId: "1:65348878130:web:7b7a107dc0243340f1212b"
});

const deleteCollection = async collection => {
  const collectionReference = await firebase.firestore().collection(collection).get();
  await Promise.all(collectionReference.docs.map(async document => {
    console.log(`Deleting ${collection}/${document.id}...`);
    await document.ref.delete();
    console.log(`Deleted ${collection}/${document.id}.`);
  }));
};

const initialize = async () => {
  await deleteCollection("talks");
  await deleteCollection("teams");
  await deleteCollection("users");
  await deleteCollection("users2");

  console.log(`Creating teams/...`);
  const teams = firebase.firestore().collection("teams");
  const team1 = await teams.add({
    name: "Team 1",
  });
  const team2 = await teams.add({
    name: "Team 2",
  });
  const team3 = await teams.add({
    name: "Team 3",
  });

  console.log(`Creating users/...`);
  const users = firebase.firestore().collection("users");
  const userId = (teamId, userName) => Array.from(
    `${teamId}:${userName}`,
    byte => byte.charCodeAt(0).toString(16).padStart(2, "0")
  ).join("");
  const userUser1Id = userId(team1.id, "User 1");
  const userUser1Reference = firebase.firestore().doc(`users/${userUser1Id}`);
  await users.doc(userUser1Id).set({
    name: "User 1",
    team: firebase.firestore().doc(`teams/${team1.id}`),
    authenticationId: null,
    roles: ["editor", "scheduler"],
  });
  const userUser2Id = userId(team1.id, "User 2");
  const userUser2Reference = firebase.firestore().doc(`users/${userUser2Id}`);
  await users.doc(userUser2Id).set({
    name: "User 2",
    team: firebase.firestore().doc(`teams/${team1.id}`),
    authenticationId: null,
    roles: ["editor"],
  });
  const userUser3Id = userId(team2.id, "User 3");
  const userUser3Reference = firebase.firestore().doc(`users/${userUser3Id}`);
  await users.doc(userUser3Id).set({
    name: "User 3",
    team: firebase.firestore().doc(`teams/${team2.id}`),
    authenticationId: null,
    roles: [],
  });
  const userUser4Id = userId(team3.id, "User 4");
  const userUser4Reference = firebase.firestore().doc(`users/${userUser4Id}`);
  await users.doc(userUser4Id).set({
    name: "User 4",
    team: firebase.firestore().doc(`teams/${team3.id}`),
    authenticationId: null,
    roles: [],
  });

  console.log(`Creating talks/...`);
  // past talks
  const pastTimestamp = firebase.firestore.Timestamp.fromMillis(firebase.firestore.Timestamp.now().toMillis() - (2 * 3600 * 1000));
  await firebase.firestore().collection("talks").add({
    createdAt: pastTimestamp,
    creator: userUser1Reference,
    description: "Past Test Description",
    duration: 3600,
    location: "Location 1",
    nerds: [userUser2Reference, userUser4Reference],
    noobs: [userUser3Reference, userUser1Reference],
    scheduledAt: pastTimestamp,
    title: "Past Test Title",
  });
  // upcoming talks
  const nowTimestamp = firebase.firestore.Timestamp.now();
  await firebase.firestore().collection("talks").add({
    createdAt: nowTimestamp,
    creator: userUser1Reference,
    description: "Upcoming Test Description",
    duration: 3600,
    location: "Location 1",
    nerds: [userUser2Reference, userUser4Reference],
    noobs: [userUser3Reference, userUser1Reference],
    scheduledAt: nowTimestamp,
    title: "Upcoming Test Title",
  });
  // unscheduled talks
  await firebase.firestore().collection("talks").add({
    createdAt: nowTimestamp,
    creator: userUser1Reference,
    description: "Unscheduled Test Description",
    nerds: [userUser2Reference, userUser4Reference],
    noobs: [userUser3Reference, userUser1Reference],
    title: "Unscheduled Test Title",
  });

  firebase.firestore().terminate();
};

initialize();
