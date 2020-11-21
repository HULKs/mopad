import { useState, useEffect } from "react";
import firebase from "firebase/app";

function sortByScheduledAt([talkIdA, talkA], [talkIdB, talkB]) {
  return talkA.scheduledAt.toMillis() - talkB.scheduledAt.toMillis();
}

function sortByCreatedAt([talkIdA, talkA], [talkIdB, talkB]) {
  return talkA.createdAt.toMillis() - talkB.createdAt.toMillis();
}

function partitionTalks(
  talks,
  setPast,
  setCurrent,
  setUpcoming,
  setUnscheduled
) {
  setPast(
    talks
      .filter(
        ([, talk]) =>
          "scheduledAt" in talk &&
          "duration" in talk &&
          "location" in talk &&
          talk.scheduledAt.toMillis() + talk.duration * 1000 <
            firebase.firestore.Timestamp.now().toMillis()
      )
      .sort(sortByScheduledAt)
  );

  setCurrent(
    talks
      .filter(
        ([, talk]) =>
          "scheduledAt" in talk &&
          "duration" in talk &&
          "location" in talk &&
          talk.scheduledAt.toMillis() <
            firebase.firestore.Timestamp.now().toMillis() &&
          talk.scheduledAt.toMillis() + talk.duration * 1000 >=
            firebase.firestore.Timestamp.now().toMillis()
      )
      .sort(sortByScheduledAt)
  );

  setUpcoming(
    talks
      .filter(
        ([, talk]) =>
          "scheduledAt" in talk &&
          "duration" in talk &&
          "location" in talk &&
          talk.scheduledAt.toMillis() >=
            firebase.firestore.Timestamp.now().toMillis()
      )
      .sort(sortByScheduledAt)
  );

  setUnscheduled(
    talks
      .filter(
        ([, talk]) =>
          !("scheduledAt" in talk) ||
          !("duration" in talk) ||
          !("location" in talk)
      )
      .sort(sortByCreatedAt)
  );
}

export default function usePartitionedTalks(talks) {
  const [past, setPast] = useState([]);
  const [current, setCurrent] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [unscheduled, setUnscheduled] = useState([]);

  useEffect(() => {
    let timeouts = [];

    for (const [, talk] of talks) {
      if ("scheduledAt" in talk && "duration" in talk && "location" in talk) {
        if (
          talk.scheduledAt.toMillis() >=
          firebase.firestore.Timestamp.now().toMillis()
        ) {
          timeouts = [
            ...timeouts,
            setTimeout(
              () =>
                partitionTalks(
                  talks,
                  setPast,
                  setCurrent,
                  setUpcoming,
                  setUnscheduled
                ),
              talk.scheduledAt.toMillis() -
                firebase.firestore.Timestamp.now().toMillis()
            ),
          ];
        }
        if (
          talk.scheduledAt.toMillis() + talk.duration * 1000 >=
          firebase.firestore.Timestamp.now().toMillis()
        ) {
          timeouts = [
            ...timeouts,
            setTimeout(
              () =>
                partitionTalks(
                  talks,
                  setPast,
                  setCurrent,
                  setUpcoming,
                  setUnscheduled
                ),
              talk.scheduledAt.toMillis() +
                talk.duration * 1000 -
                firebase.firestore.Timestamp.now().toMillis()
            ),
          ];
        }
      }
    }

    partitionTalks(talks, setPast, setCurrent, setUpcoming, setUnscheduled);

    return () => {
      for (const timeout of timeouts) {
        clearTimeout(timeout);
      }
    };
  }, [talks]);

  return [past, current, upcoming, unscheduled];
}
