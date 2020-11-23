const fs = require("fs").promises;
const admin = require("firebase-admin");

const serviceAccount = require("./mopad-hulks-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://mopad-hulks.firebaseio.com",
});

async function initDocuments() {
  const teams = [
    "B-Human",
    "Bembelbots",
    "Berlin United",
    "BitBots",
    "BlueWave",
    "DinoBytes",
    "DutchNaoTeam",
    "HS-KL",
    "HULKs",
    "MiPal",
    "NaoDevils",
    "NomadZ",
    "Rinobot",
    "RoboEirann",
    "rUNSWift",
    "SPQR",
    "UnBeatables",
    "UT Austin Villa",
  ];
  for (const team of teams) {
    const teamId = Array.from(team, byte => byte.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    console.log(`Setting document teams/${teamId}...`);
    await admin.firestore().doc(`teams/${teamId}`).set({ name: team });
  }
  await admin.firestore().collection("talks").add({
    createdAt: admin.firestore.Timestamp.now(),
    creator: admin.firestore().doc("users/firestore-admin"),
    title: "vRoHOW 2020 Kick-Off",
    description: "Open ceremony",
    nerds: [],
    noobs: [],
    scheduledAt: admin.firestore.Timestamp.fromDate(new Date("2020-12-04 19:00:00 +1")),
    duration: 1800,
    location: "Discord",
  });
}

function valueToJSON(value) {
  if (value instanceof admin.firestore.Timestamp) {
    return {
      "type": "Timestamp",
      "seconds": value.seconds,
      "nanoseconds": value.nanoseconds,
    };
  }
  if (value instanceof admin.firestore.DocumentReference) {
    return {
      "type": "DocumentReference",
      "path": value.path,
    };
  }
  if (value instanceof Array) {
    return value.map(valueToJSON);
  }
  return value;
}

async function backupDocuments(fileName) {
  const collections = {};
  const collectionReferences = await admin.firestore().listCollections();
  for (const collectionReference of collectionReferences) {
    const documents = {};
    const documentReferences = await collectionReference.listDocuments();
    for (const documentReference of documentReferences) {
      console.log(`Getting document ${documentReference.path}...`);
      const documentSnapshot = await documentReference.get();
      const document = documentSnapshot.data();
      documents[documentReference.id] = Object.entries(document)
        .reduce(
          (documentJSON, [key, value]) => ({
            ...documentJSON,
            [key]: valueToJSON(value),
          }),
          {},
        );
    }
    collections[collectionReference.id] = documents;
  }
  await fs.writeFile(fileName, JSON.stringify(collections, null, 2));
}

function valueFromJSON(value) {
  if (value instanceof Array) {
    return value.map(valueFromJSON);
  }
  if (typeof value === "object" && "type" in value) {
    switch (value.type) {
      case "Timestamp": {
        return new admin.firestore.Timestamp(value.seconds, value.nanoseconds);
      }
      case "DocumentReference": {
        return admin.firestore().doc(value.path);
      }
    }
  }
  return value;
}

async function wipeDocuments() {
  const collectionReferences = await admin.firestore().listCollections();
  for (const collectionReference of collectionReferences) {
    const documentReferences = await collectionReference.listDocuments();
    for (const documentReference of documentReferences) {
      console.log(`Deleting document ${documentReference.path}...`);
      await documentReference.delete();
    }
  }
}

async function restore(fileName) {
  const collections = JSON.parse(await fs.readFile(fileName));
  for (const [collectionId, documents] of Object.entries(collections)) {
    for (const [documentId, document] of Object.entries(documents)) {
      console.log(`Setting document ${collectionId}/${documentId}...`);
      await admin.firestore().doc(`${collectionId}/${documentId}`).set(
        Object.entries(document)
          .reduce(
            (documentJSON, [key, value]) => ({
              ...documentJSON,
              [key]: valueFromJSON(value),
            }),
            {},
          ),
      );
    }
  }
}

async function backupUsers(fileName) {
  console.log("Getting users...");
  let nextPageToken = undefined;
  let users = [];
  while(true) {
    const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
    users = [...users, ...listUsersResult.users.map(user => user.toJSON())];
    nextPageToken = listUsersResult.pageToken;
    if (!nextPageToken) {
      break;
    }
  }
  await fs.writeFile(fileName, JSON.stringify(users, null, 2));
  process.exit(0); // workaround: terminate after operations finished
}

async function restoreUsers(fileName, passwordHashParametersFileName) {
  const users = JSON.parse(await fs.readFile(fileName));
  const passwordHashParameters = JSON.parse(await fs.readFile(passwordHashParametersFileName));
  console.log(`Deleting ${users.length} users...`);
  await admin.auth().importUsers(
    users.map(user => ({
    ...user,
    passwordHash: Buffer.from(user.passwordHash, "base64"),
    passwordSalt: Buffer.from(user.passwordSalt, "base64"),
  })),
    {
      hash: {
        algorithm: passwordHashParameters.algorithm,
        key: Buffer.from(passwordHashParameters.base64_signer_key, "base64"),
        saltSeparator: Buffer.from(passwordHashParameters.base64_salt_separator, "base64"),
        rounds: passwordHashParameters.rounds,
        memoryCost: passwordHashParameters.mem_cost,
      },
    }
  );
  process.exit(0); // workaround: terminate after operations finished
}

async function wipeUsers() {
  console.log("Getting users...");
  let nextPageToken = undefined;
  let users = [];
  while(true) {
    const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
    users = [...users, ...listUsersResult.users.map(user => user.toJSON())];
    nextPageToken = listUsersResult.pageToken;
    if (!nextPageToken) {
      break;
    }
  }
  console.log(`Deleting ${users.length} users...`);
  await admin.auth().deleteUsers(users.map(user => user.uid));
  process.exit(0); // workaround: terminate after operations finished
}

if (process.argv.length < 3) {
  console.error(`Usage: ${process.argv[0]} ${process.argv[1]} init-documents`);
  console.error(`Usage: ${process.argv[0]} ${process.argv[1]} backup-documents DUMP_JSON_FILE`);
  console.error(`Usage: ${process.argv[0]} ${process.argv[1]} restore-documents DUMP_JSON_FILE`);
  console.error(`Usage: ${process.argv[0]} ${process.argv[1]} wipe-documents`);
  console.error(`Usage: ${process.argv[0]} ${process.argv[1]} backup-users DUMP_JSON_FILE`);
  console.error(`Usage: ${process.argv[0]} ${process.argv[1]} restore-users DUMP_JSON_FILE PASSWORD_HASH_PARAMETERS`);
  console.error(`Usage: ${process.argv[0]} ${process.argv[1]} wipe-users`);
  process.exit(1);
}

switch (process.argv[2]) {
  case "init-documents": {
    initDocuments();
    break;
  }
  case "backup-documents": {
    backupDocuments(process.argv[3]);
    break;
  }
  case "restore-documents": {
    restore(process.argv[3]);
    break;
  }
  case "wipe-documents": {
    wipeDocuments();
    break;
  }
  case "backup-users": {
    backupUsers(process.argv[3]);
    break;
  }
  case "restore-users": {
    restoreUsers(process.argv[3], process.argv[4]);
    break;
  }
  case "wipe-users": {
    wipeUsers();
    break;
  }
  default: {
    console.error(`Unknown command ${process.argv[2]}`);
    process.exit(1);
  }
}
